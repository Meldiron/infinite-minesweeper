import { signOutFn } from '@/lib/api/auth'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/sign-out')({
  beforeLoad: async () => {
    await signOutFn()
    throw redirect({ to: '/' })
  },
})
