import { account } from '@/lib/appwrite'
import { getCurrentUser, isAnonymousUser, resetCurrentUser } from './auth'
import { guestNickname } from './nicknames'
import { setNickname } from './onboarding'

// Anonymous session, then a free generated nickname. No server round trip besides Appwrite.
export async function createAnonymousSessionFn() {
  await account.createAnonymousSession()
  resetCurrentUser()
  const userId = (await account.get()).$id
  for (let attempt = 0; attempt < 10; attempt++) {
    const nickname = guestNickname()
    try {
      await setNickname(userId, nickname, attempt === 0)
      return { nickname }
    } catch (e) {
      if (e instanceof Error && e.message.includes('already taken')) continue
      throw e
    }
  }
  throw new Error('Could not find a free nickname, please try again')
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
