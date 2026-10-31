import { Query } from 'appwrite'
import { DATABASE_ID, TABLES, tablesDB } from '@/lib/appwrite'
import { requireUserId } from './auth'
import { callGameFunction } from './game-function'
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

// Nicknames are public, so availability is a plain read. The function re-checks on write.
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

export async function completeOnboardingFn({
  data,
}: {
  data: { nickname: string }
}) {
  await callGameFunction('/nickname', { nickname: data.nickname.trim() })
  return { success: true }
}
