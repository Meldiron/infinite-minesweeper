import { memo } from 'react'
import { Flag, Bomb } from 'lucide-react'
import type { CellState } from './useInfiniteGrid'
import type { Theme } from './MinesweeperGame'

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-500',
  2: 'text-green-500',
  3: 'text-red-500',
  4: 'text-purple-600',
  5: 'text-amber-700',
  6: 'text-cyan-500',
  7: 'text-stone-800',
  8: 'text-stone-600',
}

const NUMBER_COLORS_DARK: Record<number, string> = {
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
  theme: Theme
  sectorComplete: boolean
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
  theme,
  sectorComplete,
}: CellProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!gameOver && !state.flagged) {
      onReveal(x, y)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!gameOver && !state.revealed) {
      onFlag(x, y)
    }
  }

  const fontSize = Math.max(10, size * 0.5)
  const iconSize = Math.max(10, size * 0.45)

  const isDark = theme === 'dark'

  // Use different number colors for completed sectors
  const numberColors = sectorComplete
    ? NUMBER_COLORS_COMPLETE
    : isDark
      ? NUMBER_COLORS_DARK
      : NUMBER_COLORS

  // Theme-based styles with sector completion override
  const revealedBg = sectorComplete
    ? 'bg-green-400 border-green-500'
    : isDark
      ? 'bg-stone-800 border-stone-700'
      : 'bg-stone-400 border-stone-500'

  const mineBg = sectorComplete
    ? 'bg-green-500 border-green-600'
    : isDark
      ? 'bg-stone-700 border-stone-600'
      : 'bg-stone-500 border-stone-600'

  const unrevealedBg = sectorComplete
    ? 'bg-gradient-to-br from-green-400 to-green-500 border-t-2 border-l-2 border-green-300 border-r-2 border-b-2 border-r-green-600 border-b-green-600'
    : isDark
      ? 'bg-gradient-to-br from-stone-700 to-stone-800 border-t-2 border-l-2 border-stone-600 border-r-2 border-b-2 border-r-stone-900 border-b-stone-900 hover:from-stone-650 hover:to-stone-750'
      : 'bg-gradient-to-br from-stone-500 to-stone-600 border-t-2 border-l-2 border-stone-400 border-r-2 border-b-2 border-r-stone-700 border-b-stone-700 hover:from-stone-450 hover:to-stone-550'

  const bombIconColor = sectorComplete
    ? 'text-green-800'
    : isDark
      ? 'text-stone-400'
      : 'text-stone-900'

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
            className={`font-bold font-mono ${numberColors[adjacentMines] || (sectorComplete ? 'text-green-900' : isDark ? 'text-stone-300' : 'text-stone-800')}`}
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
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  )
})
