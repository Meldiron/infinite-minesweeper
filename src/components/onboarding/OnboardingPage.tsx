import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  checkNicknameAvailableFn,
  completeOnboardingFn,
} from '@/lib/api/onboarding'

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
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-900 p-6 overflow-hidden">
      <Card className="w-full max-w-md bg-stone-800 border-stone-700">
        <CardHeader className="text-center">
          <CardTitle className="text-lg md:text-2xl text-stone-100">
            Welcome!
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-stone-400">
            Choose a nickname to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="nickname"
                className="text-sm font-medium text-stone-300"
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
                  className={`h-12 pr-10 bg-stone-700 border-stone-600 text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:ring-amber-500/20 ${
                    inputStatus === 'error'
                      ? 'border-red-500/50'
                      : inputStatus === 'available'
                        ? 'border-green-500/50'
                        : ''
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {inputStatus === 'checking' && (
                    <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                  )}
                  {inputStatus === 'available' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {inputStatus === 'error' && nickname.length > 0 && (
                    <X className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {isAvailable && !error && (
                <p className="text-sm text-green-400">Nickname is available!</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isChecking || !isAvailable || !!error}
              className="h-12 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50"
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

          <p className="mt-6 text-center text-xs text-stone-500">
            Your nickname will be visible to other players
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
