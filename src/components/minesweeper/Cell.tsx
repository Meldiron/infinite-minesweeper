import { memo, useRef, useCallback } from 'react'
import { Flag, Bomb } from 'lucide-react'
import type { CellState } from './useInfiniteGrid'

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-amber-400',
  6: 'text-cyan-400',
  7: 'text-stone-300',
  8: 'text-stone-400',
}

// Number colors for completed sectors (darker for contrast on green)
const NUMBER_COLORS_COMPLETE: Record<number, string> = {
  1: 'text-blue-700',
  2: 'text-green-800',
  3: 'text-red-700',
  4: 'text-purple-800',
  5: 'text-amber-800',
  6: 'text-cyan-700',
  7: 'text-stone-900',
  8: 'text-stone-800',
}

const LONG_PRESS_DURATION = 500 // 500ms for long press

export type MobileInteractionMode = 'default' | 'reverse'

type CellProps = {
  x: number
  y: number
  size: number
  state: CellState
  isMine: boolean
  adjacentMines: number
  onReveal: (x: number, y: number) => void
  onFlag: (x: number, y: number) => void
  gameOver: boolean
  sectorComplete: boolean
  isMobile?: boolean
  mobileMode?: MobileInteractionMode
  onLongPressAction?: () => void
  shouldAllowClick?: () => boolean
}

export const Cell = memo(function Cell({
  x,
  y,
  size,
  state,
  isMine,
  adjacentMines,
  onReveal,
  onFlag,
  gameOver,
  sectorComplete,
  isMobile = false,
  mobileMode = 'default',
  onLongPressAction,
  shouldAllowClick,
}: CellProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (gameOver) return

    // Check if click should be allowed (not after a drag)
    if (shouldAllowClick && !shouldAllowClick()) {
      return
    }

    if (mobileMode === 'default') {
      // Default: click = reveal
      if (!state.flagged) {
        onReveal(x, y)
      }
    } else {
      // Reverse: click = flag
      if (!state.revealed) {
        onFlag(x, y)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (gameOver) return

    // Check if click should be allowed (not after a drag)
    if (shouldAllowClick && !shouldAllowClick()) {
      return
    }

    if (mobileMode === 'default') {
      // Default: right-click = flag
      if (!state.revealed) {
        onFlag(x, y)
      }
    } else {
      // Reverse: right-click = reveal
      if (!state.flagged) {
        onReveal(x, y)
      }
    }
  }

  // Mobile touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || gameOver) return

      const touch = e.touches[0]
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      isLongPressRef.current = false
      hasMovedRef.current = false

      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true

        // Trigger flash effect
        onLongPressAction?.()

        // Long press action based on mode
        if (mobileMode === 'default') {
          // Default: long press = flag
          if (!state.revealed) {
            onFlag(x, y)
          }
        } else {
          // Reverse: long press = reveal
          if (!state.flagged) {
            onReveal(x, y)
          }
        }
      }, LONG_PRESS_DURATION)
    },
    [
      isMobile,
      gameOver,
      mobileMode,
      state.revealed,
      state.flagged,
      onFlag,
      onReveal,
      x,
      y,
      onLongPressAction,
    ],
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)

    // Cancel long press if finger moved too much (user is panning)
    if (dx > 10 || dy > 10) {
      hasMovedRef.current = true
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || gameOver) return

    // Clear the long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // If it was a long press, action already happened
    if (isLongPressRef.current) {
      isLongPressRef.current = false
      touchStartPosRef.current = null
      hasMovedRef.current = false
      return
    }

    // If user was panning, don't trigger tap action
    if (hasMovedRef.current) {
      touchStartPosRef.current = null
      hasMovedRef.current = false
      return
    }

    // Short tap action based on mode
    if (mobileMode === 'default') {
      // Default: tap = reveal
      if (!state.flagged) {
        onReveal(x, y)
      }
    } else {
      // Reverse: tap = flag
      if (!state.revealed) {
        onFlag(x, y)
      }
    }

    touchStartPosRef.current = null
    hasMovedRef.current = false
  }, [
    isMobile,
    gameOver,
    mobileMode,
    state.flagged,
    state.revealed,
    onReveal,
    onFlag,
    x,
    y,
  ])

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    isLongPressRef.current = false
    touchStartPosRef.current = null
    hasMovedRef.current = false
  }, [])

  const fontSize = Math.max(10, size * 0.5)
  const iconSize = Math.max(10, size * 0.45)

  // Use different number colors for completed sectors
  const numberColors = sectorComplete ? NUMBER_COLORS_COMPLETE : NUMBER_COLORS

  // Dark theme styles with sector completion override
  const revealedBg = sectorComplete
    ? 'bg-green-400 border-green-500'
    : 'bg-stone-800 border-stone-700'

  const mineBg = sectorComplete
    ? 'bg-green-500 border-green-600'
    : 'bg-stone-700 border-stone-600'

  const unrevealedBg = sectorComplete
    ? 'bg-gradient-to-br from-green-400 to-green-500 border-t-2 border-l-2 border-green-300 border-r-2 border-b-2 border-r-green-600 border-b-green-600'
    : 'bg-gradient-to-br from-stone-700 to-stone-800 border-t-2 border-l-2 border-stone-600 border-r-2 border-b-2 border-r-stone-900 border-b-stone-900 hover:from-stone-650 hover:to-stone-750'

  const bombIconColor = sectorComplete ? 'text-green-800' : 'text-stone-400'

  // Common touch props for interactive cells
  const touchProps = isMobile
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
      }
    : {}

  // Revealed cell
  if (state.revealed) {
    if (state.exploded) {
      return (
        <div
          className="absolute flex items-center justify-center bg-red-500 border border-red-700"
          style={{
            width: size - 1,
            height: size - 1,
            left: x * size,
            top: y * size,
          }}
        >
          <Bomb size={iconSize} className="text-white" />
        </div>
      )
    }

    if (isMine) {
      return (
        <div
          className={`absolute flex items-center justify-center ${mineBg}`}
          style={{
            width: size - 1,
            height: size - 1,
            left: x * size,
            top: y * size,
          }}
        >
          <Bomb size={iconSize} className={bombIconColor} />
        </div>
      )
    }

    return (
      <div
        className={`absolute flex items-center justify-center ${revealedBg}`}
        style={{
          width: size - 1,
          height: size - 1,
          left: x * size,
          top: y * size,
        }}
      >
        {adjacentMines > 0 && (
          <span
            className={`font-bold font-mono ${numberColors[adjacentMines] || (sectorComplete ? 'text-green-900' : 'text-stone-300')}`}
            style={{ fontSize }}
          >
            {adjacentMines}
          </span>
        )}
      </div>
    )
  }

  // Flagged cell
  if (state.flagged) {
    return (
      <div
        className={`absolute flex items-center justify-center cursor-pointer ${unrevealedBg} transition-colors`}
        style={{
          width: size - 1,
          height: size - 1,
          left: x * size,
          top: y * size,
        }}
        onClick={isMobile ? undefined : handleClick}
        onContextMenu={handleContextMenu}
        {...touchProps}
      >
        <Flag
          size={iconSize}
          className={sectorComplete ? 'text-green-800' : 'text-red-600'}
          fill="currentColor"
        />
      </div>
    )
  }

  // Unrevealed cell
  return (
    <div
      className={`absolute flex items-center justify-center cursor-pointer ${unrevealedBg} active:bg-stone-600 active:border transition-colors`}
      style={{
        width: size - 1,
        height: size - 1,
        left: x * size,
        top: y * size,
      }}
      onClick={isMobile ? undefined : handleClick}
      onContextMenu={handleContextMenu}
      {...touchProps}
    />
  )
})
