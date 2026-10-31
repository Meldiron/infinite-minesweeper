import { createFileRoute } from '@tanstack/react-router'
import { authMiddleware } from '@/lib/api/auth'

export const Route = createFileRoute('/_public')({
  loader: async () => {
    const { currentUser } = await authMiddleware()

    return {
      currentUser,
    }
  },
})
