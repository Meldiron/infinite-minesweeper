import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flag,
  Grid3X3,
  Move,
  Sun,
  Moon,
  Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GameState } from './useInfiniteGrid'
import type { Theme } from './MinesweeperGame'

type GameControlsProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  gameState: GameState
  revealedCount: number
  flaggedCount: number
  onResetView: () => void
  theme: Theme
  onToggleTheme: () => void
  lives: number
  maxLives: number
  timeUntilNextLife: number | null
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function GameControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  revealedCount,
  flaggedCount,
  onResetView,
  theme,
  onToggleTheme,
  lives,
  maxLives,
  timeUntilNextLife,
}: GameControlsProps) {
  const isDark = theme === 'dark'
  const panelBg = isDark
    ? 'bg-stone-900/95 text-stone-100'
    : 'bg-white/95 text-stone-800'
  const iconColor = isDark ? 'text-stone-300' : 'text-stone-600'
  const dividerColor = isDark ? 'bg-stone-600' : 'bg-stone-300'

  return (
    <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-4 pointer-events-none z-10">
      {/* Left side - Game info */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div
          className={`${panelBg} backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-4 transition-colors duration-300`}
        >
          {/* Lives display */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxLives }).map((_, i) => (
              <Heart
                key={i}
                size={18}
                className={
                  i < lives ? 'text-red-500 fill-red-500' : 'text-stone-500'
                }
              />
            ))}
            {timeUntilNextLife !== null && lives < maxLives && (
              <span className="ml-2 font-mono text-xs text-stone-400">
                +1 in {formatTime(timeUntilNextLife)}
              </span>
            )}
          </div>
          <div className={`w-px h-5 ${dividerColor}`} />
          <div className="flex items-center gap-2">
            <Grid3X3 size={18} className={iconColor} />
            <span className="font-mono text-sm font-medium">
              {revealedCount}
            </span>
          </div>
          <div className={`w-px h-5 ${dividerColor}`} />
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-red-500" />
            <span className="font-mono text-sm font-medium">
              {flaggedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div
          className={`${panelBg} backdrop-blur-sm rounded-lg shadow-lg p-1 flex items-center gap-1 transition-colors duration-300`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            className={`h-8 w-8 ${isDark ? 'hover:bg-stone-700' : 'hover:bg-stone-100'}`}
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </Button>
          <span className="font-mono text-sm w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            className={`h-8 w-8 ${isDark ? 'hover:bg-stone-700' : 'hover:bg-stone-100'}`}
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleTheme}
          className={`h-10 w-10 ${panelBg} backdrop-blur-sm shadow-lg border-0 transition-colors duration-300`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onResetView}
          className={`h-10 w-10 ${panelBg} backdrop-blur-sm shadow-lg border-0 transition-colors duration-300`}
          title="Reset view"
        >
          <Move size={18} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          className={`h-10 w-10 ${panelBg} backdrop-blur-sm shadow-lg border-0 transition-colors duration-300`}
          title="New game"
        >
          <RotateCcw size={18} />
        </Button>
      </div>
    </div>
  )
}

type GameInstructionsProps = {
  theme: Theme
}

export function GameInstructions({ theme }: GameInstructionsProps) {
  const isDark = theme === 'dark'
  const panelBg = isDark
    ? 'bg-stone-900/95 text-stone-300'
    : 'bg-white/95 text-stone-600'

  return (
    <div
      className={`absolute bottom-4 left-4 ${panelBg} backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-sm pointer-events-none z-10 transition-colors duration-300`}
    >
      <div className="flex flex-col gap-1">
        <span>
          <strong>Left click</strong> to reveal
        </span>
        <span>
          <strong>Right click</strong> to flag
        </span>
        <span>
          <strong>Scroll</strong> to zoom • <strong>Drag</strong> to pan
        </span>
      </div>
    </div>
  )
}
