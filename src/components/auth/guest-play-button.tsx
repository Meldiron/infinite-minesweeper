import { useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { createAnonymousSessionFn } from '@/server/functions/guest-auth'
import { User } from 'lucide-react'

interface GuestPlayButtonProps {
  redirectTo?: string
}

export function GuestPlayButton({ redirectTo }: GuestPlayButtonProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const createAnonymousSession = useServerFn(createAnonymousSessionFn)

  const guestMutation = useMutation({
    mutationFn: async () => {
      await createAnonymousSession({
        data: { redirect: redirectTo },
      })
    },
    onSuccess: async () => {
      await router.invalidate()
      if (redirectTo) {
        navigate({ to: redirectTo })
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: async (error: any) => {
      // Check if it's a redirect (TanStack Start throws redirects as errors)
      if (
        error?.status === 302 ||
        error?.redirect ||
        error?.message?.includes('redirect')
      ) {
        await router.invalidate()
        if (redirectTo) {
          navigate({ to: redirectTo })
        }
        return
      }
      console.error('Guest play error:', error)
    },
  })

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full bg-stone-700 border-stone-600 text-stone-200 hover:bg-stone-600 hover:text-stone-100"
      onClick={() => guestMutation.mutate()}
      disabled={guestMutation.isPending}
    >
      <User className="mr-2 h-4 w-4" />
      {guestMutation.isPending ? 'Starting...' : 'Play as Guest'}
    </Button>
  )
}
