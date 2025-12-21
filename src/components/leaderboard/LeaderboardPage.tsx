import { useState, useEffect, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Trophy,
  Medal,
  Award,
  Grid3X3,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Users,
} from 'lucide-react'
import {
  getLeaderboardFn,
  getLeaderboardCountFn,
  syncLeaderboardStatsFn,
} from '@/server/functions/leaderboard'

type LeaderboardEntry = {
  id: string
  nickname: string
  tilesOpened: number
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalPlayers, setTotalPlayers] = useState(0)

  const getLeaderboard = useServerFn(getLeaderboardFn)
  const getLeaderboardCount = useServerFn(getLeaderboardCountFn)
  const syncLeaderboardStats = useServerFn(syncLeaderboardStatsFn)

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      try {
        // First sync stats to ensure all onboarded users have public-readable stats
        await syncLeaderboardStats()

        const [leaderboardResult, countResult] = await Promise.all([
          getLeaderboard({ data: { cursor: null } }),
          getLeaderboardCount(),
        ])

        setEntries(leaderboardResult.entries)
        setNextCursor(leaderboardResult.nextCursor)
        setHasMore(leaderboardResult.hasMore)
        setTotalPlayers(countResult.total)
      } catch (error) {
        console.error('Failed to load leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [getLeaderboard, getLeaderboardCount, syncLeaderboardStats])

  // Load more
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const result = await getLeaderboard({ data: { cursor: nextCursor } })
      setEntries((prev) => [...prev, ...result.entries])
      setNextCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error('Failed to load more:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [nextCursor, isLoadingMore, getLeaderboard])

  // Get rank icon based on position
  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
            <Trophy size={18} className="text-amber-500" />
          </div>
        )
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-400/20">
            <Medal size={18} className="text-stone-400" />
          </div>
        )
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20">
            <Award size={18} className="text-amber-700" />
          </div>
        )
      default:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-700">
            <span className="text-sm font-mono text-stone-400">{rank}</span>
          </div>
        )
    }
  }

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  return (
    <div className="min-h-screen w-full bg-stone-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button
              variant="outline"
              size="icon"
              className="bg-stone-800 border-stone-700 text-stone-100 hover:bg-stone-700 hover:text-stone-100"
            >
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-100">Leaderboard</h1>
            <p className="text-stone-400 text-sm">
              Top players by tiles opened
            </p>
          </div>
        </div>

        {/* Stats Card */}
        <Card className="bg-stone-800 border-stone-700 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2 text-stone-400">
              <Users size={18} />
              <span>
                <span className="text-stone-100 font-semibold">
                  {totalPlayers.toLocaleString()}
                </span>{' '}
                players competing
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="bg-stone-800 border-stone-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-stone-100 flex items-center gap-2">
              <Trophy size={20} className="text-amber-500" />
              Top Players
            </CardTitle>
            <CardDescription className="text-stone-400">
              Ranked by total tiles opened
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="text-amber-500 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 size={48} className="text-stone-600 mx-auto mb-4" />
                <p className="text-stone-400">No players yet</p>
                <p className="text-stone-500 text-sm mt-1">
                  Be the first to join the leaderboard!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, index) => {
                  const rank = index + 1
                  const isTopThree = rank <= 3

                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        isTopThree
                          ? 'bg-stone-700/50'
                          : 'bg-stone-800 hover:bg-stone-700/30'
                      }`}
                    >
                      {getRankDisplay(rank)}

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium truncate ${
                            isTopThree ? 'text-stone-100' : 'text-stone-300'
                          }`}
                        >
                          {entry.nickname}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <Grid3X3
                          size={14}
                          className={
                            isTopThree ? 'text-amber-500' : 'text-stone-500'
                          }
                        />
                        <span
                          className={`font-mono text-sm ${
                            isTopThree ? 'text-amber-500' : 'text-stone-400'
                          }`}
                        >
                          {formatNumber(entry.tilesOpened)}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Load More Button */}
                {hasMore && (
                  <div className="pt-4">
                    <Button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      variant="outline"
                      className="w-full bg-stone-700 border-stone-600 text-stone-100 hover:bg-stone-600 hover:text-stone-100"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} className="mr-2" />
                          Load More
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to Game CTA */}
        <div className="mt-6 text-center">
          <Link to="/play">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white">
              Play Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
