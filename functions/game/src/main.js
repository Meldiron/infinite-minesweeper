/**
 * Background checks for the static site. Nobody calls this function directly
 * (execute is empty); it only runs on row events, so players never wait for it.
 *
 * Players create and update their own rows with the web SDK. A player can only
 * grant permissions to their own user role, so a row whose ID equals the single
 * user in its permissions was created by that user. Anything else is deleted.
 *
 *   user_onboarding create/update  check owner + nickname rules, then create or
 *                                  rename the player's public leaderboard row
 *   minesweeper_saves create/update check owner, recount opened tiles from the
 *                                  stored save into user_stats
 *   user_preferences create        check owner
 *
 * user_stats has no client permissions at all: only this function writes it,
 * so there is exactly one leaderboard row per player with a valid nickname.
 */
import {
  AppwriteException,
  Client,
  Permission,
  Role,
  TablesDB,
} from 'node-appwrite'

const DATABASE_ID = process.env.APPWRITE_DB_ID || 'imagine-project-db'
const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/
// Subscribed as `databases.…`; Appwrite reports TablesDB events as `tablesdb.…`
const EVENT_PATTERN =
  /^(?:databases|tablesdb)\.([^.]+)\.tables\.([^.]+)\.rows\.([^.]+)\.(create|update)$/

// The one user named in a row's permissions, or null if there is none or several.
export function ownerOf(permissions) {
  const users = new Set()
  for (const permission of permissions) {
    const match = /"user:([^"/]+)(?:\/[^"]*)?"/.exec(permission)
    if (match) users.add(match[1])
  }
  return users.size === 1 ? [...users][0] : null
}

export function countRevealed(cellStatesJson) {
  try {
    return Object.values(JSON.parse(cellStatesJson || '{}')).filter(
      (cell) => cell && cell.revealed === true,
    ).length
  } catch {
    return 0
  }
}

export default async ({ req, res, log, error }) => {
  const event = req.headers['x-appwrite-event'] || ''
  const match = EVENT_PATTERN.exec(event)
  if (!match || match[1] !== DATABASE_ID) {
    log(`ignored event "${event}"`)
    return res.json({ message: 'This function only handles row events' }, 400)
  }
  const [, , tableId, rowId] = match

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'])
  const db = new TablesDB(client)
  const ref = (table, id) => ({
    databaseId: DATABASE_ID,
    tableId: table,
    rowId: id,
  })

  const getRow = async (table, id) => {
    try {
      return await db.getRow(ref(table, id))
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 404) return null
      throw e
    }
  }
  const deleteRow = async (table, id) => {
    try {
      await db.deleteRow(ref(table, id))
    } catch (e) {
      if (!(e instanceof AppwriteException && e.code === 404)) throw e
    }
  }

  // Create or update the public leaderboard row. Only this function writes it.
  const writeStats = async (userId, data) => {
    const existing = await getRow('user_stats', userId)
    if (existing) {
      const changed = Object.entries(data).some(([k, v]) => existing[k] !== v)
      if (changed) await db.updateRow({ ...ref('user_stats', userId), data })
      return
    }
    try {
      await db.createRow({
        ...ref('user_stats', userId),
        data: { createdBy: userId, ...data },
        permissions: [Permission.read(Role.any())],
      })
    } catch (e) {
      // A parallel event created it first
      if (!(e instanceof AppwriteException && e.code === 409)) throw e
      await db.updateRow({ ...ref('user_stats', userId), data })
    }
  }

  try {
    // Always act on the stored row, never on the event payload
    const row = await getRow(tableId, rowId)
    if (!row) return res.json({ skipped: 'row is gone' })

    if (ownerOf(row.$permissions) !== row.$id) {
      await deleteRow(tableId, rowId)
      log(`deleted ${tableId}/${rowId}: row ID does not match its owner`)
      return res.json({ deleted: true, reason: 'owner' })
    }
    const userId = row.$id

    if (tableId === 'user_onboarding') {
      if (
        !NICKNAME_PATTERN.test(row.nickname || '') ||
        !row.onboardingCompleted
      ) {
        await deleteRow('user_onboarding', userId)
        await deleteRow('user_stats', userId)
        log(`deleted onboarding/${userId}: invalid nickname`)
        return res.json({ deleted: true, reason: 'nickname' })
      }
      const save = await getRow('minesweeper_saves', userId)
      await writeStats(userId, {
        nickname: row.nickname,
        tilesOpened: save ? countRevealed(save.cellStates) : 0,
      })
      return res.json({ stats: 'updated' })
    }

    if (tableId === 'minesweeper_saves') {
      if (await getRow('user_stats', userId)) {
        await writeStats(userId, { tilesOpened: countRevealed(row.cellStates) })
      }
      return res.json({ stats: 'synced' })
    }

    return res.json({ ok: true })
  } catch (e) {
    error(e instanceof Error ? e.stack || e.message : String(e))
    return res.json({ message: 'Something went wrong' }, 500)
  }
}
