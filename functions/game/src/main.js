/**
 * The only trusted code in the app. The static site talks to Appwrite directly,
 * and calls this function for the writes a player must not do themselves:
 *
 *   POST /guest     set up a new guest: unique generated nickname + game rows
 *   POST /nickname  validate and claim a nickname (onboarding) + game rows
 *   event           a save row was updated -> recount tiles for the leaderboard
 *
 * Every row is keyed by the user ID that Appwrite puts in `x-appwrite-user-id`,
 * so nobody can create rows for someone else, and each player has exactly one
 * row per table. Players can only read/update their own save and preferences;
 * nicknames and stats are public to read and only ever written here.
 */
import {
  AppwriteException,
  Client,
  Permission,
  Query,
  Role,
  TablesDB,
} from 'node-appwrite'

const DATABASE_ID = process.env.APPWRITE_DB_ID || 'imagine-project-db'
const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/

const ADJECTIVES = [
  'Swift',
  'Brave',
  'Clever',
  'Lucky',
  'Mighty',
  'Silent',
  'Bold',
  'Quick',
  'Sharp',
  'Keen',
  'Wild',
  'Calm',
  'Fierce',
  'Noble',
  'Sly',
  'Wise',
  'Daring',
  'Nimble',
  'Stealthy',
  'Valiant',
  'Crafty',
  'Agile',
  'Fearless',
]
const NOUNS = [
  'Miner',
  'Seeker',
  'Scout',
  'Hunter',
  'Explorer',
  'Finder',
  'Sweeper',
  'Digger',
  'Tracker',
  'Ranger',
  'Pioneer',
  'Voyager',
  'Pathfinder',
  'Adventurer',
  'Wanderer',
  'Prospector',
  'Surveyor',
  'Navigator',
]
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const guestNickname = () =>
  `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(Math.random() * 1000)}`

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'])
  const db = new TablesDB(client)

  const getRow = async (tableId, rowId) => {
    try {
      return await db.getRow({ databaseId: DATABASE_ID, tableId, rowId })
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 404) return null
      throw e
    }
  }

  // Save and preferences rows are created once, owned by the player.
  const ensureGameRows = async (userId) => {
    const owner = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
    ]
    if (!(await getRow('minesweeper_saves', userId))) {
      await db.createRow({
        databaseId: DATABASE_ID,
        tableId: 'minesweeper_saves',
        rowId: userId,
        data: {
          createdBy: userId,
          cellStates: '{}',
          isFirstClick: true,
          gameOver: false,
        },
        permissions: owner,
      })
    }
    if (!(await getRow('user_preferences', userId))) {
      await db.createRow({
        databaseId: DATABASE_ID,
        tableId: 'user_preferences',
        rowId: userId,
        data: {
          createdBy: userId,
          instructionsOpen: true,
          interactionMode: 'default',
        },
        permissions: owner,
      })
    }
  }

  // Writes the nickname to onboarding (unique index) and stats. Throws 409 if taken.
  const claimNickname = async (userId, nickname) => {
    const publicRead = [Permission.read(Role.any())]
    const onboarding = await getRow('user_onboarding', userId)
    try {
      if (onboarding) {
        await db.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'user_onboarding',
          rowId: userId,
          data: { nickname, onboardingCompleted: true },
        })
      } else {
        await db.createRow({
          databaseId: DATABASE_ID,
          tableId: 'user_onboarding',
          rowId: userId,
          data: { createdBy: userId, nickname, onboardingCompleted: true },
          permissions: publicRead,
        })
      }
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 409) {
        throw new HttpError(409, 'This nickname is already taken')
      }
      throw e
    }

    const stats = await getRow('user_stats', userId)
    if (stats) {
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId: 'user_stats',
        rowId: userId,
        data: { nickname },
      })
    } else {
      await db.createRow({
        databaseId: DATABASE_ID,
        tableId: 'user_stats',
        rowId: userId,
        data: { createdBy: userId, nickname, tilesOpened: 0 },
        permissions: publicRead,
      })
    }
  }

  const isTaken = async (nickname, userId) => {
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId: 'user_onboarding',
      queries: [Query.equal('nickname', [nickname]), Query.limit(1)],
    })
    return rows.length > 0 && rows[0].$id !== userId
  }

  // Leaderboard stats come from the stored save, never from the request body.
  const syncStats = async (saveId) => {
    const save = await getRow('minesweeper_saves', saveId)
    const stats = await getRow('user_stats', saveId)
    if (!save || !stats) return 0
    let tiles = 0
    try {
      for (const cell of Object.values(JSON.parse(save.cellStates || '{}'))) {
        if (cell && cell.revealed === true) tiles++
      }
    } catch {
      tiles = 0
    }
    if (stats.tilesOpened !== tiles) {
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId: 'user_stats',
        rowId: saveId,
        data: { tilesOpened: tiles },
      })
    }
    return tiles
  }

  try {
    const event = req.headers['x-appwrite-event']
    if (event) {
      const match =
        /\.tables\.minesweeper_saves\.rows\.([^.]+)\.(update|create)$/.exec(
          event,
        )
      if (!match) return res.json({ ignored: event })
      const tiles = await syncStats(match[1])
      log(`stats ${match[1]}: ${tiles} tiles`)
      return res.json({ tiles })
    }

    const userId = req.headers['x-appwrite-user-id']
    if (!userId) throw new HttpError(401, 'Sign in first')

    if (req.method === 'POST' && req.path === '/guest') {
      const existing = await getRow('user_onboarding', userId)
      if (existing) {
        await ensureGameRows(userId)
        return res.json({ nickname: existing.nickname })
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        const nickname = guestNickname()
        if (await isTaken(nickname, userId)) continue
        try {
          await claimNickname(userId, nickname)
        } catch (e) {
          if (e instanceof HttpError && e.status === 409) continue
          throw e
        }
        await ensureGameRows(userId)
        return res.json({ nickname })
      }
      throw new HttpError(503, 'Could not find a free nickname, try again')
    }

    if (req.method === 'POST' && req.path === '/nickname') {
      const nickname = String(req.bodyJson?.nickname ?? '').trim()
      if (!NICKNAME_PATTERN.test(nickname)) {
        throw new HttpError(
          400,
          'Nickname must be 2-32 characters: letters, numbers, underscores and hyphens',
        )
      }
      if (await isTaken(nickname, userId)) {
        throw new HttpError(409, 'This nickname is already taken')
      }
      await claimNickname(userId, nickname)
      await ensureGameRows(userId)
      return res.json({ nickname })
    }

    throw new HttpError(404, 'Not found')
  } catch (e) {
    if (e instanceof HttpError)
      return res.json({ message: e.message }, e.status)
    error(e instanceof Error ? e.stack || e.message : String(e))
    return res.json({ message: 'Something went wrong' }, 500)
  }
}
