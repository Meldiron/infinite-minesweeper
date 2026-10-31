import { Permission, Query, Role } from 'appwrite'
import { DATABASE_ID, TABLES, tablesDB } from '@/lib/appwrite'
import { requireUserId } from './auth'
import { NICKNAME_PATTERN } from './nicknames'
import { ensureGameRows, isCode } from './rows'
import type { UserOnboarding } from './types'

export async function getOnboardingStatusFn() {
  const userId = await requireUserId()
  try {
    const row = await tablesDB.getRow<UserOnboarding>({
      databaseId: DATABASE_ID,
      tableId: TABLES.onboarding,
      rowId: userId,
    })
    return {
      onboarding: {
        id: row.$id,
        nickname: row.nickname,
        onboardingCompleted: row.onboardingCompleted,
      },
      isCompleted: row.onboardingCompleted,
    }
  } catch {
    return { onboarding: null, isCompleted: false }
  }
}

export async function checkNicknameAvailableFn({
  data,
}: {
  data: { nickname: string }
}) {
  const userId = await requireUserId()
  const { rows } = await tablesDB.listRows<UserOnboarding>({
    databaseId: DATABASE_ID,
    tableId: TABLES.onboarding,
    queries: [Query.equal('nickname', [data.nickname.trim()]), Query.limit(1)],
  })
  return { available: rows.length === 0 || rows[0].$id === userId }
}

/**
 * Writes the player's public nickname row. The unique index on `nickname`
 * rejects duplicates; the `game` function re-checks the format and creates the
 * leaderboard row in the background.
 */
export async function setNickname(
  userId: string,
  nickname: string,
  isNewPlayer = false,
) {
  if (!NICKNAME_PATTERN.test(nickname)) {
    throw new Error(
      'Nickname must be 2-32 characters: letters, numbers, underscores and hyphens',
    )
  }
  await ensureGameRows(userId, isNewPlayer)
  const ref = {
    databaseId: DATABASE_ID,
    tableId: TABLES.onboarding,
    rowId: userId,
  }
  const data = { nickname, onboardingCompleted: true }
  const taken = (e: unknown) =>
    isCode(e, 409, 'row_unique_constraint_violation')
  try {
    await tablesDB.createRow({
      ...ref,
      data: { createdBy: userId, ...data },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
      ],
    })
  } catch (e) {
    if (taken(e)) throw new Error('This nickname is already taken')
    if (!isCode(e, 409)) throw e
    // The player already has a nickname row: rename it
    try {
      await tablesDB.updateRow({ ...ref, data })
    } catch (e2) {
      if (taken(e2)) throw new Error('This nickname is already taken')
      throw e2
    }
  }
}

export async function completeOnboardingFn({
  data,
}: {
  data: { nickname: string }
}) {
  await setNickname(await requireUserId(), data.nickname.trim())
  return { success: true }
}
