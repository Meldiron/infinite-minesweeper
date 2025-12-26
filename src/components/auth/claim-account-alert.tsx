import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, UserPlus, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { claimAccountFn } from '@/server/functions/guest-auth'

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
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const claimAccount = useServerFn(claimAccountFn)

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
    <div className="absolute top-0 left-0 right-0 z-50 bg-amber-900/95 backdrop-blur-sm border-b border-amber-700">
      <div className="max-w-2xl mx-auto px-4 py-3">
        {!isExpanded ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-amber-100">
              <UserPlus size={18} className="text-amber-400 flex-shrink-0" />
              <span className="text-sm">
                <span className="font-medium">Playing as guest.</span>{' '}
                <span className="text-amber-200/80">
                  Add email & password to save your progress permanently.
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="secondary"
                className="bg-amber-700 hover:bg-amber-600 text-amber-100 border-0 h-8 px-3 text-xs"
                onClick={() => setIsExpanded(true)}
              >
                Claim Account
              </Button>
              <button
                onClick={handleDismiss}
                className="text-amber-400 hover:text-amber-200 p-1"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-100">
                <UserPlus size={18} className="text-amber-400" />
                <span className="font-medium text-sm">Claim Your Account</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-amber-400 hover:text-amber-200 p-1"
                aria-label="Collapse"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit((data) => claimMutation.mutate(data))}
              className="space-y-3"
            >
              {form.formState.errors.root && (
                <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/50 rounded px-3 py-2">
                  <AlertCircle size={16} />
                  {form.formState.errors.root.message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Input
                    type="email"
                    placeholder="Email address"
                    className="bg-stone-800 border-stone-600 text-stone-100 placeholder:text-stone-500 h-9 text-sm"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-300 text-xs mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Password (8+ chars)"
                    className="bg-stone-800 border-stone-600 text-stone-100 placeholder:text-stone-500 h-9 text-sm"
                    {...form.register('password')}
                  />
                  {form.formState.errors.password && (
                    <p className="text-red-300 text-xs mt-1">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    className="bg-stone-800 border-stone-600 text-stone-100 placeholder:text-stone-500 h-9 text-sm"
                    {...form.register('confirmPassword')}
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-red-300 text-xs mt-1">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={claimMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white h-8 px-4 text-xs"
                >
                  {claimMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Account'
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
