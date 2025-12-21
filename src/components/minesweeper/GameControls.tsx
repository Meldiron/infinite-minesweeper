import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flag,
  Grid3X3,
  Move,
  Heart,
  Download,
  Loader2,
  ChevronDown,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import type { GameState } from './useInfiniteGrid'

type GameControlsProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  gameState: GameState
  revealedCount: number
  flaggedCount: number
  onResetView: () => void
  lives: number
  maxLives: number
  timeUntilNextLife: number | null
  onExportPNG?: () => void
  isAtMinZoom?: boolean
  exportProgress?: number | null
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
  lives,
  maxLives,
  timeUntilNextLife,
  onExportPNG,
  isAtMinZoom,
  exportProgress,
}: GameControlsProps) {
  const isExporting = exportProgress !== null && exportProgress !== undefined

  return (
    <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none z-10">
      {/* First row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left side - Game info */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="bg-stone-900/95 text-stone-100 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
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
            <div className="w-px h-5 bg-stone-600" />
            <div className="flex items-center gap-2">
              <Grid3X3 size={18} className="text-stone-300" />
              <span className="font-mono text-sm font-medium">
                {revealedCount}
              </span>
            </div>
            <div className="w-px h-5 bg-stone-600" />
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
          <div className="bg-stone-900/95 text-stone-100 backdrop-blur-sm rounded-lg shadow-lg p-1 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomOut}
              className="h-8 w-8 hover:bg-stone-700"
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
              className="h-8 w-8 hover:bg-stone-700"
              title="Zoom in"
            >
              <ZoomIn size={18} />
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={onResetView}
            className="h-10 w-10 bg-stone-900/95 text-stone-100 backdrop-blur-sm shadow-lg border-0"
            title="Reset view"
          >
            <Move size={18} />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 bg-stone-900/95 text-stone-100 backdrop-blur-sm shadow-lg border-0"
                title="New game"
              >
                <RotateCcw size={18} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-stone-900 border-stone-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-stone-100">
                  Start New Game?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-stone-400">
                  This will reset all your progress and start a fresh game. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-stone-800 text-stone-100 border-stone-600 hover:bg-stone-700 hover:text-stone-100">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onReset}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Reset Game
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Second row - Export button (only at min zoom) */}
      {(isAtMinZoom || isExporting) && onExportPNG && (
        <div className="flex justify-end">
          <div className="bg-stone-900/95 backdrop-blur-sm rounded-lg shadow-lg pointer-events-auto overflow-hidden">
            {isExporting ? (
              <div className="px-4 py-2 flex items-center gap-3 min-w-[200px]">
                <Loader2 size={16} className="text-amber-500 animate-spin" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-stone-100 text-sm">Exporting...</span>
                    <span className="text-stone-400 text-xs font-mono">
                      {exportProgress}%
                    </span>
                  </div>
                  <Progress
                    value={exportProgress}
                    className="h-1.5 bg-stone-700 [&_[data-slot=progress-indicator]]:bg-amber-500"
                  />
                </div>
              </div>
            ) : (
              <Button
                onClick={onExportPNG}
                className="bg-transparent hover:bg-stone-800 text-stone-100 border-0 gap-2"
              >
                <Download size={16} />
                Export Map as PNG
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function GameInstructions({
  isCollapsed,
  onToggleCollapse,
}: {
  isCollapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
      {isCollapsed ? (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleCollapse}
          className="h-10 w-10 bg-stone-900/95 text-stone-100 backdrop-blur-sm shadow-lg border-0"
          title="Show instructions"
        >
          <HelpCircle size={18} />
        </Button>
      ) : (
        <div className="bg-stone-900/95 text-stone-300 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-4">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-6 w-6 -mr-2 -mt-1 hover:bg-stone-700 text-stone-400 hover:text-stone-100"
              title="Hide instructions"
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
