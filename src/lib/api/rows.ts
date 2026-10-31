import { AppwriteException, Permission, Role } from 'appwrite'
import { DATABASE_ID, TABLES, tablesDB } from '@/lib/appwrite'
import type { MinesweeperSave, UserPreferences } from './types'

// Every player-owned row uses the player's user ID as its row ID. The `game`
// function deletes any row whose ID does not match the user in its permissions.
const ownerOnly = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
]

const isCode = (e: unknown, code: number, type?: string) =>
  e instanceof AppwriteException &&
  e.code === code &&
  (type === undefined || e.type === type)

export async function getOrCreateOwnRow<
  T extends MinesweeperSave | UserPreferences,
>(
  tableId: string,
  userId: string,
  defaults: Record<string, unknown>,
  // Brand-new players skip the lookup that would always 404
  isNewPlayer = false,
): Promise<T> {
  const ref = { databaseId: DATABASE_ID, tableId, rowId: userId }
  if (!isNewPlayer) {
    try {
      return await tablesDB.getRow<T>(ref)
    } catch (e) {
      if (!isCode(e, 404)) throw e
    }
  }
  try {
    const created = await tablesDB.createRow({
      ...ref,
      data: { createdBy: userId, ...defaults },
      permissions: ownerOnly(userId),
    })
    return created as unknown as T
  } catch (e) {
    // Another tab or request created it in the meantime
    if (!isCode(e, 409)) throw e
    return tablesDB.getRow<T>(ref)
  }
}

export const ensureSave = (userId: string, isNewPlayer = false) =>
  getOrCreateOwnRow<MinesweeperSave>(
    TABLES.saves,
    userId,
    { cellStates: '{}', isFirstClick: true, gameOver: false },
    isNewPlayer,
  )

export const ensurePreferences = (userId: string, isNewPlayer = false) =>
  getOrCreateOwnRow<UserPreferences>(
    TABLES.preferences,
    userId,
    { instructionsOpen: true, interactionMode: 'default' },
    isNewPlayer,
  )

// Create the private rows before the public nickname row, so a player's ID is
// never visible to others before their own rows exist.
export async function ensureGameRows(userId: string, isNewPlayer = false) {
  await Promise.all([
    ensureSave(userId, isNewPlayer),
    ensurePreferences(userId, isNewPlayer),
  ])
}

export { isCode }
