import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { Query } from 'node-appwrite'
import { db } from '@/server/lib/db'

const LEADERBOARD_PAGE_SIZE = 20

// Get leaderboard with cursor pagination
export const getLeaderboardFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z
      .object({
        cursor: z.string().nullable().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const cursor = data?.cursor

    try {
      const queries = [
        Query.orderDesc('tilesOpened'),
        Query.limit(LEADERBOARD_PAGE_SIZE + 1), // Fetch one extra to check if there's more
      ]

      // If we have a cursor, use it for pagination
      if (cursor) {
        queries.push(Query.cursorAfter(cursor))
      }

      const result = await db.userStats.list(queries)

      // Check if there are more results
      const hasMore = result.rows.length > LEADERBOARD_PAGE_SIZE
      const rows = hasMore
        ? result.rows.slice(0, LEADERBOARD_PAGE_SIZE)
        : result.rows

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
