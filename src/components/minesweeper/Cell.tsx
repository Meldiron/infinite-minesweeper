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
  7: 'text-gray-800',
  8: 'text-gray-600',
}

const NUMBER_COLORS_DARK: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-amber-400',
  6: 'text-cyan-400',
  7: 'text-gray-300',
  8: 'text-gray-400',
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
  const numberColors = isDark ? NUMBER_COLORS_DARK : NUMBER_COLORS

  // Theme-based styles
  const revealedBg = isDark
    ? 'bg-gray-700 border-gray-600'
    : 'bg-gray-200 border-gray-300'
  const mineBg = isDark
    ? 'bg-gray-600 border-gray-500'
    : 'bg-gray-300 border-gray-400'
  const unrevealedBg = isDark
    ? 'bg-gradient-to-br from-gray-500 to-gray-600 border-t-2 border-l-2 border-gray-400 border-r-2 border-b-2 border-r-gray-700 border-b-gray-700 hover:from-gray-450 hover:to-gray-550'
    : 'bg-gradient-to-br from-gray-300 to-gray-400 border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-gray-500 border-b-gray-500 hover:from-gray-350 hover:to-gray-450'
  const bombIconColor = isDark ? 'text-gray-300' : 'text-gray-800'

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
            className={`font-bold font-mono ${numberColors[adjacentMines] || (isDark ? 'text-gray-300' : 'text-gray-800')}`}
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
        <Flag size={iconSize} className="text-red-600" fill="currentColor" />
      </div>
    )
  }

  // Unrevealed cell
  return (
    <div
      className={`absolute flex items-center justify-center cursor-pointer ${unrevealedBg} active:bg-gray-400 active:border transition-colors`}
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
