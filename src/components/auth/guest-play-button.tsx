import { useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { createAnonymousSessionFn } from '@/lib/api/guest-auth'
import { User } from 'lucide-react'

interface GuestPlayButtonProps {
  redirectTo?: string
}

export function GuestPlayButton({
  redirectTo = '/play',
}: GuestPlayButtonProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const createAnonymousSession = createAnonymousSessionFn

  const guestMutation = useMutation({
    mutationFn: async () => {
      await createAnonymousSession()
    },
    onSuccess: async () => {
      await router.invalidate()
      navigate({ to: redirectTo })
    },
    onError: (error) => {
      console.error('Guest play error:', error)
    },
  })

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="w-full bg-stone-700 border-stone-600 text-stone-200 hover:bg-stone-600 hover:text-stone-100 px-8 py-6 text-lg"
      onClick={() => guestMutation.mutate()}
      disabled={guestMutation.isPending}
    >
      <User className="mr-2 h-5 w-5" />
      {guestMutation.isPending ? 'Starting...' : 'Play as Guest'}
    </Button>
  )
}
