import { useState, useCallback } from 'react'

// Deterministic hash function for consistent mine placement
function hashCoord(x: number, y: number, seed: number = 12345): number {
  let h = seed
  h = Math.imul(h ^ x, 0x9e3779b9)
  h = Math.imul(h ^ y, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35)
  return (h >>> 0) / 0xffffffff
}

// Check if a cell has a mine (deterministic based on coordinates)
export function hasMine(
  x: number,
  y: number,
  seed: number = 12345,
  density: number = 0.15,
): boolean {
  return hashCoord(x, y, seed) < density
}

// Get adjacent cell coordinates
export function getNeighbors(x: number, y: number): [number, number][] {
  return [
    [x - 1, y - 1],
    [x, y - 1],
    [x + 1, y - 1],
    [x - 1, y],
    [x + 1, y],
    [x - 1, y + 1],
    [x, y + 1],
    [x + 1, y + 1],
  ]
}

// Count adjacent mines
export function countAdjacentMines(
  x: number,
  y: number,
  seed: number = 12345,
  density: number = 0.15,
): number {
  return getNeighbors(x, y).filter(([nx, ny]) => hasMine(nx, ny, seed, density))
    .length
}

export type CellState = {
  revealed: boolean
  flagged: boolean
  exploded?: boolean
}

export type GameState = 'playing' | 'won' | 'lost'

export function useInfiniteGrid(seed: number = 12345, density: number = 0.15) {
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(
    new Map(),
  )
  const [gameState, setGameState] = useState<GameState>('playing')
  const [revealedCount, setRevealedCount] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)

  const getKey = useCallback((x: number, y: number) => `${x},${y}`, [])

  const getCellState = useCallback(
    (x: number, y: number): CellState => {
      const key = getKey(x, y)
      return cellStates.get(key) || { revealed: false, flagged: false }
    },
    [cellStates, getKey],
  )

  const revealCell = useCallback(
    (x: number, y: number) => {
      if (gameState !== 'playing') return

      const key = getKey(x, y)
      const current = cellStates.get(key)

      if (current?.revealed || current?.flagged) return

      const newStates = new Map(cellStates)
      const toReveal: [number, number][] = [[x, y]]
      let revealed = 0

      while (toReveal.length > 0) {
        const [cx, cy] = toReveal.pop()!
        const cellKey = getKey(cx, cy)
        const cellState = newStates.get(cellKey)

        if (cellState?.revealed || cellState?.flagged) continue

        const isMine = hasMine(cx, cy, seed, density)

        if (isMine) {
          newStates.set(cellKey, {
            revealed: true,
            flagged: false,
            exploded: true,
          })
          setCellStates(newStates)
          setGameState('lost')
          return
        }

        newStates.set(cellKey, { revealed: true, flagged: false })
        revealed++

        const adjacentMines = countAdjacentMines(cx, cy, seed, density)

        // If no adjacent mines, reveal neighbors
        if (adjacentMines === 0) {
          for (const [nx, ny] of getNeighbors(cx, cy)) {
            const neighborKey = getKey(nx, ny)
            const neighborState = newStates.get(neighborKey)
            if (!neighborState?.revealed && !neighborState?.flagged) {
              toReveal.push([nx, ny])
            }
          }
        }
      }

      setCellStates(newStates)
      setRevealedCount((prev) => prev + revealed)
    },
    [cellStates, gameState, getKey, seed, density],
  )

  const toggleFlag = useCallback(
    (x: number, y: number) => {
      if (gameState !== 'playing') return

      const key = getKey(x, y)
      const current = cellStates.get(key)

      if (current?.revealed) return

      const newStates = new Map(cellStates)
      const wasFlagged = current?.flagged || false
      newStates.set(key, { revealed: false, flagged: !wasFlagged })
      setCellStates(newStates)
      setFlaggedCount((prev) => prev + (wasFlagged ? -1 : 1))
    },
    [cellStates, gameState, getKey],
  )

  const resetGame = useCallback(() => {
    setCellStates(new Map())
    setGameState('playing')
    setRevealedCount(0)
    setFlaggedCount(0)
  }, [])

  return {
    getCellState,
    revealCell,
    toggleFlag,
    resetGame,
    gameState,
    revealedCount,
    flaggedCount,
    hasMine: (x: number, y: number) => hasMine(x, y, seed, density),
    countAdjacentMines: (x: number, y: number) =>
      countAdjacentMines(x, y, seed, density),
  }
}
