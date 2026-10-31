import { ID, type Models } from 'appwrite'
import { account } from '@/lib/appwrite'

export type CurrentUser = Models.User<Models.Preferences>

// One account.get() per page load; reset whenever the session changes.
let currentUser: Promise<CurrentUser | null> | null = null

export function getCurrentUser(): Promise<CurrentUser | null> {
  currentUser ??= account.get().catch(() => null)
  return currentUser
}

export function resetCurrentUser() {
  currentUser = null
}

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user.$id
}

export const isAnonymousUser = (user: CurrentUser | null) =>
  !!user && !user.email

type Credentials = { data: { email: string; password: string } }

export async function signUpFn({ data }: Credentials) {
  await account.create({
    userId: ID.unique(),
    email: data.email,
    password: data.password,
  })
  await account.createEmailPasswordSession(data)
  resetCurrentUser()
}

export async function signInFn({ data }: Credentials) {
  await account.createEmailPasswordSession(data)
  resetCurrentUser()
}

export async function signOutFn() {
  try {
    await account.deleteSession({ sessionId: 'current' })
  } finally {
    resetCurrentUser()
  }
}

export async function authMiddleware() {
  return { currentUser: await getCurrentUser() }
}
