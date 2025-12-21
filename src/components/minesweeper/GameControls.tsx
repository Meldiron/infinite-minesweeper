import { ZoomIn, ZoomOut, RotateCcw, Flag, Grid3X3, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}

export function GameControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  gameState,
  revealedCount,
  flaggedCount,
  onResetView,
}: GameControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-4 pointer-events-none z-10">
      {/* Left side - Game info */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Grid3X3 size={18} className="text-gray-600" />
            <span className="font-mono text-sm font-medium">
              {revealedCount}
            </span>
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-red-500" />
            <span className="font-mono text-sm font-medium">
              {flaggedCount}
            </span>
          </div>
        </div>

        {gameState === 'lost' && (
          <div className="bg-red-500 text-white rounded-lg shadow-lg px-4 py-2 font-bold animate-pulse">
            💥 Game Over!
          </div>
        )}
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            className="h-8 w-8"
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
            className="h-8 w-8"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onResetView}
          className="h-10 w-10 bg-white/95 backdrop-blur-sm shadow-lg"
          title="Reset view"
        >
          <Move size={18} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          className="h-10 w-10 bg-white/95 backdrop-blur-sm shadow-lg"
          title="New game"
        >
          <RotateCcw size={18} />
        </Button>
      </div>
    </div>
  )
}

export function GameInstructions() {
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-sm text-gray-600 pointer-events-none z-10">
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
