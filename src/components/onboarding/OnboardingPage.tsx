import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { User, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  checkNicknameAvailableFn,
  completeOnboardingFn,
} from '@/server/functions/onboarding'

export function OnboardingPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null)

  const validateNickname = (value: string): string | null => {
    if (value.length < 2) {
      return 'Nickname must be at least 2 characters'
    }
    if (value.length > 32) {
      return 'Nickname must be at most 32 characters'
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Only letters, numbers, underscores, and hyphens allowed'
    }
    return null
  }

  const checkNickname = useCallback(async (value: string) => {
    const validationError = validateNickname(value)
    if (validationError) {
      setError(validationError)
      setIsAvailable(null)
      setIsChecking(false)
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const result = await checkNicknameAvailableFn({
        data: { nickname: value },
      })
      setIsAvailable(result.available)
      if (!result.available) {
        setError('This nickname is already taken')
      }
    } catch {
      setError('Failed to check nickname availability')
      setIsAvailable(null)
    } finally {
      setIsChecking(false)
    }
  }, [])

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNickname(value)
    setIsAvailable(null)
    setError(null)

    // Clear existing timeout
    if (checkTimeout) {
      clearTimeout(checkTimeout)
    }

    // Don't check if empty or too short
    if (value.length < 2) {
      if (value.length > 0) {
        setError('Nickname must be at least 2 characters')
      }
      return
    }

    // Debounce the availability check
    const timeout = setTimeout(() => {
      checkNickname(value)
    }, 500)
    setCheckTimeout(timeout)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateNickname(nickname)
    if (validationError) {
      setError(validationError)
      return
    }

    if (!isAvailable) {
      setError('Please choose an available nickname')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await completeOnboardingFn({ data: { nickname: nickname.trim() } })
      // Navigate to game
      router.navigate({ to: '/play' })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to complete onboarding')
      }
      setIsSubmitting(false)
    }
  }

  const getInputStatus = () => {
    if (isChecking) return 'checking'
    if (error) return 'error'
    if (isAvailable) return 'available'
    return 'idle'
  }

  const inputStatus = getInputStatus()

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          'linear-gradient(135deg, #1A1F2C 0%, #2D1F3D 50%, #1A1F2C 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                type: 'spring',
                stiffness: 200,
              }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500"
            >
              <User className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="mb-2 text-2xl font-bold text-white">Welcome!</h1>
            <p className="text-sm text-white/60">
              Choose a nickname to get started
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="nickname"
                className="text-sm font-medium text-white/80"
              >
                Nickname
              </Label>
              <div className="relative">
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={handleNicknameChange}
                  placeholder="Enter your nickname"
                  maxLength={32}
                  disabled={isSubmitting}
                  className={`h-12 border-white/20 bg-white/5 pr-10 text-white placeholder:text-white/40 focus:border-purple-500 focus:ring-purple-500/20 ${
                    inputStatus === 'error'
                      ? 'border-red-500/50'
                      : inputStatus === 'available'
                        ? 'border-green-500/50'
                        : ''
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {inputStatus === 'checking' && (
                    <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                  )}
                  {inputStatus === 'available' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {inputStatus === 'error' && nickname.length > 0 && (
                    <X className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}
              {isAvailable && !error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-green-400"
                >
                  Nickname is available!
                </motion.p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isChecking || !isAvailable || !!error}
              className="h-12 w-full bg-gradient-to-r from-purple-600 to-pink-600 font-semibold text-white transition-all hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Continue to Game'
              )}
            </Button>
          </form>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-white/40">
            Your nickname will be visible to other players
          </p>
        </div>
      </motion.div>
    </div>
  )
}
