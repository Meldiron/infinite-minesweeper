import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { redirect } from '@tanstack/react-router'
import { createAdminClient, createSessionClient } from '../lib/appwrite'
import { AppwriteException } from 'node-appwrite'
import {
  setResponseStatus,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'

// Helper to get session (duplicated from auth.ts since we can't import private functions)
const getSession = () => {
  return getCookie('appwrite-session-secret')
}

// Helper to set session cookies
const setSessionCookies = (id: string, secret: string) => {
  setCookie('appwrite-session-secret', secret, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  })

  setCookie('appwrite-session-id', id, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  })
}

// Create anonymous session for guest play
export const createAnonymousSessionFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ redirect: z.string().optional() }))
  .handler(async ({ data }) => {
    const { redirect: redirectUrl } = data

    try {
      const { account } = createAdminClient()
      const session = await account.createAnonymousSession()
      setSessionCookies(session.$id, session.secret)
    } catch (_error) {
      const error = _error as AppwriteException
      setResponseStatus(error.code)
      throw {
        message: error.message,
        status: error.code,
      }
    }

    if (redirectUrl) {
      throw redirect({ to: redirectUrl })
    } else {
      throw redirect({ to: '/' })
    }
  })

// Claim anonymous account by adding email and password
const claimAccountSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const claimAccountFn = createServerFn({ method: 'POST' })
  .inputValidator(claimAccountSchema)
  .handler(async ({ data }) => {
    const { email, password } = data
    const session = getSession()

    if (!session) {
      setResponseStatus(401)
      throw {
        message: 'Not authenticated',
        status: 401,
      }
    }

    try {
      const client = await createSessionClient(session)

      // Add email to the account
      await client.account.updateEmail({ email, password })

      return { success: true }
    } catch (_error) {
      const error = _error as AppwriteException
      setResponseStatus(error.code)
      throw {
        message: error.message,
        status: error.code,
      }
    }
  })

// Check if current user is anonymous
export const isAnonymousUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = getSession()

    if (!session) {
      return { isAnonymous: false, isAuthenticated: false }
    }

    try {
      const client = await createSessionClient(session)
      const user = await client.account.get()

      // User is anonymous if they have no email
      const isAnonymous = !user.email

      return { isAnonymous, isAuthenticated: true }
    } catch {
      return { isAnonymous: false, isAuthenticated: false }
    }
  },
)
