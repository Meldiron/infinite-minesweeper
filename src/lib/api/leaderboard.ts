import { Query } from 'appwrite'
import { DATABASE_ID, TABLES, tablesDB } from '@/lib/appwrite'
import type { UserStats } from './types'

// Stats rows are public to read and only written by the game function.
const LEADERBOARD_PAGE_SIZE = 20

type PageInput = { cursor?: string | null; limit?: number }

async function listPage({ cursor, limit }: PageInput) {
  const pageSize = limit ?? LEADERBOARD_PAGE_SIZE
  const queries = [Query.orderDesc('tilesOpened'), Query.limit(pageSize + 1)]
  if (cursor) queries.push(Query.cursorAfter(cursor))
  const result = await tablesDB.listRows<UserStats>({
    databaseId: DATABASE_ID,
    tableId: TABLES.stats,
    queries,
  })
  const hasMore = result.rows.length > pageSize
  const rows = hasMore ? result.rows.slice(0, pageSize) : result.rows
  return {
    entries: rows.map((row) => ({
      id: row.$id,
      nickname: row.nickname,
      tilesOpened: row.tilesOpened,
    })),
    nextCursor: hasMore ? rows[rows.length - 1].$id : null,
    hasMore,
  }
}

export async function getLeaderboardFn({ data }: { data?: PageInput } = {}) {
  try {
    return await listPage(data ?? {})
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return { entries: [], nextCursor: null, hasMore: false }
  }
}

export async function getLeaderboardDataFn({
  data,
}: {
  data?: PageInput & { userId?: string | null }
} = {}) {
  try {
    const [page, count] = await Promise.all([
      listPage(data ?? {}),
      tablesDB.listRows<UserStats>({
        databaseId: DATABASE_ID,
        tableId: TABLES.stats,
        queries: [Query.limit(1)],
      }),
    ])

    let userRank: {
      stats: { id: string; nickname: string; tilesOpened: number }
      rank: number
    } | null = null
    if (data?.userId) {
      try {
        const own = await tablesDB.getRow<UserStats>({
          databaseId: DATABASE_ID,
          tableId: TABLES.stats,
          rowId: data.userId,
        })
        const higher = await tablesDB.listRows<UserStats>({
          databaseId: DATABASE_ID,
          tableId: TABLES.stats,
          queries: [
            Query.greaterThan('tilesOpened', own.tilesOpened),
            Query.limit(1),
          ],
        })
        userRank = {
          stats: {
            id: own.$id,
            nickname: own.nickname,
            tilesOpened: own.tilesOpened,
          },
          rank: higher.total + 1,
        }
      } catch {
        userRank = null
      }
    }

    return { ...page, total: count.total, userRank }
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
}
