import { useLoaderData } from '@tanstack/react-router'
import { signOutFn } from '@/lib/api/auth'

export function useAuth() {
  const { currentUser } = useLoaderData({ from: '__root__' })

  return {
    currentUser,
    signOut: signOutFn,
  }
}
