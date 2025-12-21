import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface AuthCardProps {
  title: string
  description: string
  children: React.ReactNode
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-stone-900 p-6">
      <Card className="w-full max-w-md bg-stone-800 border-stone-700 [&_[class*='text-muted-foreground']]:text-stone-400 [&_[class*='text-primary']]:text-amber-500 [&_a]:hover:text-amber-400">
        <CardHeader className="text-center">
          <CardTitle className="text-lg md:text-2xl text-stone-100">
            {title}
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-stone-400">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
