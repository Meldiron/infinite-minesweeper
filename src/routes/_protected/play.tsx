import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { MinesweeperGame } from '@/components/minesweeper/MinesweeperGame'
import { ClaimAccountAlert } from '@/components/auth'
import {
  getGameSaveFn,
  getUserPreferencesFn,
} from '@/server/functions/minesweeper'
import { getOnboardingStatusFn } from '@/server/functions/onboarding'
import { isAnonymousUserFn } from '@/server/functions/guest-auth'

export const Route = createFileRoute('/_protected/play')({
  component: PlayPage,
  loader: async () => {
    // Check onboarding status first - redirect if not completed
    const { isCompleted, onboarding } = await getOnboardingStatusFn()
    if (!isCompleted) {
      throw redirect({ to: '/onboarding' })
    }

    // Check if user is anonymous
    const { isAnonymous } = await isAnonymousUserFn()

    const [{ save }, { preferences }] = await Promise.all([
      getGameSaveFn(),
      getUserPreferencesFn(),
    ])
    return {
      initialSave: save,
      initialPreferences: preferences,
      nickname: onboarding?.nickname ?? 'Player',
      isAnonymous,
    }
  },
})

function PlayPage() {
  const { initialSave, initialPreferences, nickname, isAnonymous } =
    Route.useLoaderData()
  const [showClaimAlert, setShowClaimAlert] = useState(isAnonymous)

  return (
    <>
      {showClaimAlert && (
        <ClaimAccountAlert onDismiss={() => setShowClaimAlert(false)} />
      )}
      <MinesweeperGame
        initialSave={initialSave}
        initialPreferences={initialPreferences}
        nickname={nickname}
      />
    </>
  )
}
