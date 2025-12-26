import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { GuestPlayButton } from './guest-play-button'

interface AuthCardProps {
  title: string
  description: string
  children: React.ReactNode
  showGuestOption?: boolean
  guestRedirectTo?: string
}

export function AuthCard({
  title,
  description,
  children,
  showGuestOption = true,
  guestRedirectTo = '/play',
}: AuthCardProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-900 p-6 overflow-hidden">
      <Card className="w-full max-w-md bg-stone-800 border-stone-700 [&_[class*='text-muted-foreground']]:text-stone-400 [&_[class*='text-primary']]:text-amber-500 [&_a]:hover:text-amber-400">
        <CardHeader className="text-center">
          <CardTitle className="text-lg md:text-2xl text-stone-100">
            {title}
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-stone-400">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {children}

          {showGuestOption && (
            <>
              {/* Or divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-stone-800 px-2 text-stone-500">or</span>
                </div>
              </div>

              {/* Guest play button */}
              <GuestPlayButton redirectTo={guestRedirectTo} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
