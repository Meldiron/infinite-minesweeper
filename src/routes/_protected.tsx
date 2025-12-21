import { redirect } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { authMiddleware } from '@/server/functions/auth'
import { getOnboardingStatusFn } from '@/server/functions/onboarding'

export const Route = createFileRoute('/_protected')({
  loader: async ({ location }) => {
    const { currentUser } = await authMiddleware()

    if (!currentUser) {
      if (
        location.pathname !== '/sign-in' &&
        location.pathname !== '/sign-up'
      ) {
        throw redirect({ to: '/sign-in', search: { redirect: location.href } })
      }
    }

    // Check onboarding status for authenticated users
    // Skip this check if already on the onboarding page
    if (currentUser && location.pathname !== '/onboarding') {
      const { isCompleted } = await getOnboardingStatusFn()

      if (!isCompleted) {
        throw redirect({ to: '/onboarding' })
      }
    }

    return {
      currentUser,
    }
  },
})
