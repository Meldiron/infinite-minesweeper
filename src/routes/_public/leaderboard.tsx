import { createFileRoute } from '@tanstack/react-router'
import { LeaderboardPage } from '@/components/leaderboard'

export const Route = createFileRoute('/_public/leaderboard')({
  component: LeaderboardPage,
})
