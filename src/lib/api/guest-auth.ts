import { account } from '@/lib/appwrite'
import { callGameFunction } from './game-function'
import { getCurrentUser, isAnonymousUser, resetCurrentUser } from './auth'

// Anonymous session, then the game function picks a free nickname and sets up the rows.
export async function createAnonymousSessionFn() {
  await account.createAnonymousSession()
  resetCurrentUser()
  return callGameFunction<{ nickname: string }>('/guest')
}

// Adding an email and password turns the guest into a normal account.
export async function claimAccountFn({
  data,
}: {
  data: { email: string; password: string }
}) {
  await account.updateEmail({ email: data.email, password: data.password })
  resetCurrentUser()
  return { success: true }
}

export async function isAnonymousUserFn() {
  const user = await getCurrentUser()
  return { isAnonymous: isAnonymousUser(user), isAuthenticated: !!user }
}
