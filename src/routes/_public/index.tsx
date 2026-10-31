import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '@/components/landing/LandingPage'
import { authMiddleware } from '@/lib/api/auth'

export const Route = createFileRoute('/_public/')({
  component: HomePage,
  loader: async () => {
    const { currentUser } = await authMiddleware()

    // Redirect authenticated users to the game
    if (currentUser) {
      throw redirect({ to: '/play' })
    }

    return { currentUser: null }
  },
})

function HomePage() {
  return <LandingPage />
}
