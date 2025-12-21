import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth'
import { db } from '@/server/lib/db'
import { Query } from 'node-appwrite'

// Get the current user's onboarding status
export const getOnboardingStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      const result = await db.userOnboarding.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (result.rows.length === 0) {
        return { onboarding: null, isCompleted: false }
      }

      const onboarding = result.rows[0]
      return {
        onboarding: {
          id: onboarding.$id,
          nickname: onboarding.nickname,
          onboardingCompleted: onboarding.onboardingCompleted,
        },
        isCompleted: onboarding.onboardingCompleted,
      }
    } catch (error) {
      console.error('Error fetching onboarding status:', error)
      return { onboarding: null, isCompleted: false }
    }
  },
)

// Check if a nickname is available
export const checkNicknameAvailableFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ nickname: z.string().min(1).max(32) }))
  .handler(async ({ data }) => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      const result = await db.userOnboarding.list([
        Query.equal('nickname', [data.nickname.trim()]),
        Query.limit(1),
      ])

      // If no results, nickname is available
      // If result exists but belongs to current user, it's still "available" for them
      const isAvailable =
        result.rows.length === 0 || result.rows[0].createdBy === currentUser.$id

      return { available: isAvailable }
    } catch (error) {
      console.error('Error checking nickname availability:', error)
      throw new Error('Failed to check nickname availability')
    }
  })

// Complete onboarding with nickname
export const completeOnboardingFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      nickname: z
        .string()
        .min(2, 'Nickname must be at least 2 characters')
        .max(32, 'Nickname must be at most 32 characters')
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          'Nickname can only contain letters, numbers, underscores, and hyphens',
        ),
    }),
  )
  .handler(async ({ data }) => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    const nickname = data.nickname.trim()

    try {
      // Check if nickname is taken by someone else
      const existingNickname = await db.userOnboarding.list([
        Query.equal('nickname', [nickname]),
        Query.limit(1),
      ])

      if (
        existingNickname.rows.length > 0 &&
        existingNickname.rows[0].createdBy !== currentUser.$id
      ) {
        throw new Error('Nickname is already taken')
      }

      // Check if user already has onboarding record
      const existingOnboarding = await db.userOnboarding.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (existingOnboarding.rows.length > 0) {
        // Update existing record
        const updated = await db.userOnboarding.update(
          existingOnboarding.rows[0].$id,
          {
            nickname,
            onboardingCompleted: true,
          },
        )
        return {
          success: true,
          onboardingId: updated.$id,
        }
      } else {
        // Create new onboarding record
        const created = await db.userOnboarding.create({
          createdBy: currentUser.$id,
          nickname,
          onboardingCompleted: true,
        })
        return {
          success: true,
          onboardingId: created.$id,
        }
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to complete onboarding')
    }
  })
