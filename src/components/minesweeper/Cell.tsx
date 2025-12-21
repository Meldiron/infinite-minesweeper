import { memo } from 'react'
import { Flag, Bomb } from 'lucide-react'
import type { CellState } from './useInfiniteGrid'

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
          className="absolute flex items-center justify-center bg-gray-300 border border-gray-400"
          style={{
            width: size - 1,
            height: size - 1,
            left: x * size,
            top: y * size,
          }}
        >
          <Bomb size={iconSize} className="text-gray-800" />
        </div>
      )
    }

    return (
      <div
        className="absolute flex items-center justify-center bg-gray-200 border border-gray-300"
        style={{
          width: size - 1,
          height: size - 1,
          left: x * size,
          top: y * size,
        }}
      >
        {adjacentMines > 0 && (
          <span
            className={`font-bold font-mono ${NUMBER_COLORS[adjacentMines] || 'text-gray-800'}`}
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
        className="absolute flex items-center justify-center cursor-pointer bg-gradient-to-br from-gray-300 to-gray-400 border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-gray-500 border-b-gray-500 hover:from-gray-350 hover:to-gray-450 transition-colors"
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
      className="absolute flex items-center justify-center cursor-pointer bg-gradient-to-br from-gray-300 to-gray-400 border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-gray-500 border-b-gray-500 hover:from-gray-350 hover:to-gray-450 active:bg-gray-400 active:border transition-colors"
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
