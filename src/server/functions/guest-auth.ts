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
import { db, Query, Permission, Role } from './db-helper'

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

// Generate a random guest nickname
const generateGuestNickname = (): string => {
  const adjectives = [
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
  const nouns = [
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

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 1000)

  return `${adjective}${noun}${number}`
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

      // Generate a unique nickname for the guest
      let nickname = generateGuestNickname()
      let attempts = 0
      const maxAttempts = 10

      // Ensure nickname is unique
      while (attempts < maxAttempts) {
        const existing = await db.userOnboarding.list([
          Query.equal('nickname', [nickname]),
          Query.limit(1),
        ])

        if (existing.rows.length === 0) {
          break
        }

        nickname = generateGuestNickname()
        attempts++
      }

      // Create onboarding record with auto-generated nickname
      await db.userOnboarding.create({
        createdBy: session.userId,
        nickname,
        onboardingCompleted: true,
      })

      // Create userStats record for leaderboard
      await db.userStats.create(
        {
          createdBy: session.userId,
          nickname,
          tilesOpened: 0,
        },
        {
          permissions: [
            Permission.read(Role.any()),
            Permission.write(Role.user(session.userId)),
            Permission.update(Role.user(session.userId)),
            Permission.delete(Role.user(session.userId)),
          ],
        },
      )
    } catch (_error) {
      const error = _error as AppwriteException
      setResponseStatus(error.code || 500)
      throw {
        message: error.message,
        status: error.code || 500,
      }
    }

    // Redirect directly to play (skip onboarding)
    if (redirectUrl) {
      throw redirect({ to: redirectUrl })
    } else {
      throw redirect({ to: '/play' })
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
