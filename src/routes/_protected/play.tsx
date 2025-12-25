import { createFileRoute, redirect } from '@tanstack/react-router'
import { MinesweeperGame } from '@/components/minesweeper/MinesweeperGame'
import {
  getGameSaveFn,
  getUserPreferencesFn,
} from '@/server/functions/minesweeper'
import { getOnboardingStatusFn } from '@/server/functions/onboarding'

export const Route = createFileRoute('/_protected/play')({
  component: PlayPage,
  loader: async () => {
    // Check onboarding status first - redirect if not completed
    const { isCompleted, onboarding } = await getOnboardingStatusFn()
    if (!isCompleted) {
      throw redirect({ to: '/onboarding' })
    }

    const [{ save }, { preferences }] = await Promise.all([
      getGameSaveFn(),
      getUserPreferencesFn(),
    ])
    return {
      initialSave: save,
      initialPreferences: preferences,
      nickname: onboarding?.nickname ?? 'Player',
    }
  },
})

function PlayPage() {
  const { initialSave, initialPreferences, nickname } = Route.useLoaderData()

  return (
    <MinesweeperGame
      initialSave={initialSave}
      initialPreferences={initialPreferences}
      nickname={nickname}
    />
  )
}
