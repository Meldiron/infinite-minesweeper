import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { claimAccountFn } from '@/lib/api/guest-auth'

const claimSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ClaimFormData = z.infer<typeof claimSchema>

interface ClaimAccountAlertProps {
  onDismiss?: () => void
}

export function ClaimAccountAlert({ onDismiss }: ClaimAccountAlertProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const claimAccount = claimAccountFn

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const claimMutation = useMutation({
    mutationFn: async (data: ClaimFormData) => {
      await claimAccount({
        data: { email: data.email, password: data.password },
      })
    },
    onSuccess: async () => {
      setIsSuccess(true)
      setIsModalOpen(false)
      await router.invalidate()
      // Auto-hide after success
      setTimeout(() => {
        setIsDismissed(true)
        onDismiss?.()
      }, 2000)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.error('Claim account error:', error)
      form.setError('root', {
        message: error.message || 'Failed to claim account',
      })
    },
  })

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isDismissed) return null

  if (isSuccess) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 bg-green-900/95 backdrop-blur-sm border-b border-green-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2 text-green-100">
          <Check size={18} />
          <span className="font-medium">
            Account claimed successfully! Your progress is now saved.
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Single-row alert bar */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-amber-950/80 backdrop-blur-md border-b border-amber-500 px-3 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-100 min-w-0">
            <UserPlus size={16} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs truncate">
              <span className="font-medium">Playing as guest.</span>{' '}
              <span className="text-amber-200/80 hidden sm:inline">
                Add email & password to save your progress.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="bg-amber-700 hover:bg-amber-600 text-amber-100 border-0 h-6 px-2.5 text-xs"
              onClick={() => setIsModalOpen(true)}
            >
              Claim Account
            </Button>
            <button
              onClick={handleDismiss}
              className="text-amber-400 hover:text-amber-200 text-xs font-medium px-1"
            >
              Later
            </button>
          </div>
        </div>
      </div>

      {/* Claim account modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-stone-800 border-stone-700 text-stone-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-100">
              <UserPlus size={20} className="text-amber-400" />
              Claim Your Account
            </DialogTitle>
            <DialogDescription className="text-stone-400">
              Add an email and password to save your progress permanently and
              access your account from any device.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((data) => claimMutation.mutate(data))}
            className="space-y-4 mt-2"
          >
            {form.formState.errors.root && (
              <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/50 rounded px-3 py-2">
                <AlertCircle size={16} />
                {form.formState.errors.root.message}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Email address"
                  className="bg-stone-900 border-stone-600 text-stone-100 placeholder:text-stone-500"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-red-400 text-xs mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password (8+ characters)"
                  className="bg-stone-900 border-stone-600 text-stone-100 placeholder:text-stone-500"
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p className="text-red-400 text-xs mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  className="bg-stone-900 border-stone-600 text-stone-100 placeholder:text-stone-500"
                  {...form.register('confirmPassword')}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-stone-400 hover:text-stone-100 hover:bg-stone-700"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={claimMutation.isPending}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Account'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
