import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db, Query, Permission, Role } from './db-helper'

const LEADERBOARD_PAGE_SIZE = 20

// Type for leaderboard entry stats
type LeaderboardStats = {
  id: string
  nickname: string
  tilesOpened: number
} | null

// Combined function to get all leaderboard data in one request
export const getLeaderboardDataFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z
      .object({
        cursor: z.string().nullable().optional(),
        limit: z.number().min(1).max(100).optional(),
        userId: z.string().nullable().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const cursor = data?.cursor
    const pageSize = data?.limit ?? LEADERBOARD_PAGE_SIZE
    const userId = data?.userId

    try {
      // Build queries for leaderboard
      const queries = [
        Query.orderDesc('tilesOpened'),
        Query.limit(pageSize + 1),
      ]

      if (cursor) {
        queries.push(Query.cursorAfter(cursor))
      }

      // Fetch leaderboard and total count in parallel
      const [leaderboardResult, countResult] = await Promise.all([
        db.userStats.list(queries),
        db.userStats.list([Query.limit(1)]), // For total count
      ])

      // Fetch user stats separately if userId provided (to maintain proper typing)
      let userStatsResult: typeof leaderboardResult | null = null
      if (userId) {
        userStatsResult = await db.userStats.list([
          Query.equal('createdBy', [userId]),
          Query.limit(1),
        ])
      }

      // Process leaderboard entries
      const hasMore = leaderboardResult.rows.length > pageSize
      const rows = hasMore
        ? leaderboardResult.rows.slice(0, pageSize)
        : leaderboardResult.rows
      const nextCursor = hasMore ? rows[rows.length - 1].$id : null

      const entries = rows.map((row) => ({
        id: row.$id,
        nickname: row.nickname,
        tilesOpened: row.tilesOpened,
      }))

      // Process user rank if we have user stats
      let userRank: { stats: LeaderboardStats; rank: number } | null = null
      if (userStatsResult && userStatsResult.rows.length > 0) {
        const userStats = userStatsResult.rows[0]

        // Count players with more tiles (single query)
        const higherRankedResult = await db.userStats.list([
          Query.greaterThan('tilesOpened', userStats.tilesOpened),
          Query.limit(1),
        ])

        userRank = {
          stats: {
            id: userStats.$id,
            nickname: userStats.nickname,
            tilesOpened: userStats.tilesOpened,
          },
          rank: higherRankedResult.total + 1,
        }
      }

      return {
        entries,
        nextCursor,
        hasMore,
        total: countResult.total,
        userRank,
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard data:', error)
      return {
        entries: [],
        nextCursor: null,
        hasMore: false,
        total: 0,
        userRank: null,
      }
    }
  })

// Get leaderboard with cursor pagination (kept for load more)
export const getLeaderboardFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z
      .object({
        cursor: z.string().nullable().optional(),
        limit: z.number().min(1).max(100).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const cursor = data?.cursor
    const pageSize = data?.limit ?? LEADERBOARD_PAGE_SIZE

    try {
      const queries = [
        Query.orderDesc('tilesOpened'),
        Query.limit(pageSize + 1), // Fetch one extra to check if there's more
      ]

      // If we have a cursor, use it for pagination
      if (cursor) {
        queries.push(Query.cursorAfter(cursor))
      }

      const result = await db.userStats.list(queries)

      // Check if there are more results
      const hasMore = result.rows.length > pageSize
      const rows = hasMore ? result.rows.slice(0, pageSize) : result.rows

      // Get the last item's ID for the next cursor
      const nextCursor = hasMore ? rows[rows.length - 1].$id : null

      // Map to leaderboard entries
      const entries = rows.map((row) => ({
        id: row.$id,
        nickname: row.nickname,
        tilesOpened: row.tilesOpened,
        // Calculate rank based on cursor position
        // If no cursor, start from 1; otherwise we'll need to track position
      }))

      return {
        entries,
        nextCursor,
        hasMore,
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      return {
        entries: [],
        nextCursor: null,
        hasMore: false,
      }
    }
  })

// Get total count of players on leaderboard
export const getLeaderboardCountFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const result = await db.userStats.list([Query.limit(1)])
      return { total: result.total }
    } catch (error) {
      console.error('Failed to fetch leaderboard count:', error)
      return { total: 0 }
    }
  },
)

// Get current user's stats and rank
export const getCurrentUserRankFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    try {
      // Get user's stats
      const userStatsResult = await db.userStats.list([
        Query.equal('createdBy', [data.userId]),
        Query.limit(1),
      ])

      if (userStatsResult.rows.length === 0) {
        return { stats: null, rank: null }
      }

      const userStats = userStatsResult.rows[0]

      // Count how many players have more tiles opened than this user
      const higherRankedResult = await db.userStats.list([
        Query.greaterThan('tilesOpened', userStats.tilesOpened),
        Query.limit(1),
      ])

      // Rank is the count of players with more tiles + 1
      const rank = higherRankedResult.total + 1

      return {
        stats: {
          id: userStats.$id,
          nickname: userStats.nickname,
          tilesOpened: userStats.tilesOpened,
        },
        rank,
      }
    } catch (error) {
      console.error('Failed to fetch user rank:', error)
      return { stats: null, rank: null }
    }
  })

// Sync missing userStats from userOnboarding records
// This ensures all onboarded users appear on the leaderboard
// NOTE: This should only be called by admin/background tasks, not on page load
export const syncLeaderboardStatsFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  try {
    // Get all onboarded users
    const onboardedUsers = await db.userOnboarding.list([
      Query.equal('onboardingCompleted', [true]),
      Query.limit(1000), // Get up to 1000 users
    ])

    let created = 0
    let updated = 0

    for (const onboarding of onboardedUsers.rows) {
      // Check if user has stats
      const existingStats = await db.userStats.list([
        Query.equal('createdBy', [onboarding.createdBy]),
        Query.limit(1),
      ])

      if (existingStats.rows.length === 0) {
        // Create stats with public read permission
        await db.userStats.create(
          {
            createdBy: onboarding.createdBy,
            nickname: onboarding.nickname,
            tilesOpened: 0,
          },
          {
            permissions: [
              Permission.read(Role.any()),
              Permission.write(Role.user(onboarding.createdBy)),
              Permission.update(Role.user(onboarding.createdBy)),
              Permission.delete(Role.user(onboarding.createdBy)),
            ],
          },
        )
        created++
      } else {
        // Update existing stats to have public read permission
        await db.userStats.update(
          existingStats.rows[0].$id,
          {
            nickname: onboarding.nickname, // Sync nickname
          },
          {
            permissions: [
              Permission.read(Role.any()),
              Permission.write(Role.user(onboarding.createdBy)),
              Permission.update(Role.user(onboarding.createdBy)),
              Permission.delete(Role.user(onboarding.createdBy)),
            ],
          },
        )
        updated++
      }
    }

    return {
      success: true,
      created,
      updated,
      total: onboardedUsers.rows.length,
    }
  } catch (error) {
    console.error('Failed to sync leaderboard stats:', error)
    throw new Error('Failed to sync leaderboard stats')
  }
})
