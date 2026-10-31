import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingPage } from '@/components/onboarding'
import { getOnboardingStatusFn } from '@/lib/api/onboarding'

export const Route = createFileRoute('/_protected/onboarding')({
  component: OnboardingPageRoute,
  loader: async () => {
    // Check if user has already completed onboarding
    const { isCompleted } = await getOnboardingStatusFn()

    // If already completed, redirect to game
    if (isCompleted) {
      throw redirect({ to: '/play' })
    }

    return {}
  },
})

function OnboardingPageRoute() {
  return <OnboardingPage />
}
