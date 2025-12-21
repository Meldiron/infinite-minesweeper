import { useState, useCallback, useRef } from 'react'

// Deterministic hash function for consistent mine placement
function hashCoord(x: number, y: number, seed: number = 12345): number {
  let h = seed
  h = Math.imul(h ^ x, 0x9e3779b9)
  h = Math.imul(h ^ y, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35)
  return (h >>> 0) / 0xffffffff
}

// Check if a cell has a mine (deterministic based on coordinates)
export function hasMineBase(
  x: number,
  y: number,
  seed: number = 12345,
  density: number = 0.12,
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

export type CellState = {
  revealed: boolean
  flagged: boolean
  exploded?: boolean
}

export type GameState = 'playing' | 'won' | 'lost'

export function useInfiniteGrid(seed: number = 12345, density: number = 0.12) {
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(
    new Map(),
  )
  const [gameState, setGameState] = useState<GameState>('playing')
  const [revealedCount, setRevealedCount] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)

  // Track removed mines (for first click protection)
  const removedMinesRef = useRef<Set<string>>(new Set())
  const isFirstClickRef = useRef<boolean>(true)

  const getKey = useCallback((x: number, y: number) => `${x},${y}`, [])

  // Check if cell has mine, considering removed mines
  const hasMine = useCallback(
    (x: number, y: number): boolean => {
      const key = getKey(x, y)
      if (removedMinesRef.current.has(key)) return false
      return hasMineBase(x, y, seed, density)
    },
    [getKey, seed, density],
  )

  // Count adjacent mines considering removed mines
  const countAdjacentMines = useCallback(
    (x: number, y: number): number => {
      return getNeighbors(x, y).filter(([nx, ny]) => hasMine(nx, ny)).length
    },
    [hasMine],
  )

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

      if (current?.flagged) return

      // If cell is already revealed and has a number, try chord reveal
      if (current?.revealed) {
        const adjacentMines = countAdjacentMines(x, y)
        if (adjacentMines === 0) return

        const neighbors = getNeighbors(x, y)
        let flaggedCount = 0
        const unrevealedUnflagged: [number, number][] = []

        for (const [nx, ny] of neighbors) {
          const neighborState = getCellState(nx, ny)
          if (neighborState.flagged) {
            flaggedCount++
          } else if (!neighborState.revealed) {
            unrevealedUnflagged.push([nx, ny])
          }
        }

        // If flagged count matches the number, reveal all unflagged neighbors
        if (flaggedCount === adjacentMines && unrevealedUnflagged.length > 0) {
          for (const [nx, ny] of unrevealedUnflagged) {
            // Recursively call revealCell for each unflagged neighbor
            // We need to do this one at a time to handle game over properly
            setTimeout(() => revealCell(nx, ny), 0)
          }
        }
        return
      }

      // Handle first click - ensure it's never a mine and has large empty opening
      if (isFirstClickRef.current) {
        isFirstClickRef.current = false

        // Remove mine from clicked cell
        if (hasMineBase(x, y, seed, density)) {
          removedMinesRef.current.add(key)
        }

        // Remove mines from immediate neighbors (8 cells)
        const immediateNeighbors = getNeighbors(x, y)
        for (const [nx, ny] of immediateNeighbors) {
          const neighborKey = getKey(nx, ny)
          if (hasMineBase(nx, ny, seed, density)) {
            removedMinesRef.current.add(neighborKey)
          }
        }

        // Remove mines from second ring of neighbors to ensure 15+ empty cells
        // This covers a 5x5 area centered on the click (minus corners for a more natural shape)
        const secondRing: [number, number][] = [
          // Top row (y - 2)
          [x - 2, y - 2],
          [x - 1, y - 2],
          [x, y - 2],
          [x + 1, y - 2],
          [x + 2, y - 2],
          // Second row edges (y - 1)
          [x - 2, y - 1],
          [x + 2, y - 1],
          // Middle row edges (y)
          [x - 2, y],
          [x + 2, y],
          // Fourth row edges (y + 1)
          [x - 2, y + 1],
          [x + 2, y + 1],
          // Bottom row (y + 2)
          [x - 2, y + 2],
          [x - 1, y + 2],
          [x, y + 2],
          [x + 1, y + 2],
          [x + 2, y + 2],
        ]

        for (const [nx, ny] of secondRing) {
          const neighborKey = getKey(nx, ny)
          if (hasMineBase(nx, ny, seed, density)) {
            removedMinesRef.current.add(neighborKey)
          }
        }
      }

      const newStates = new Map(cellStates)
      const toReveal: [number, number][] = [[x, y]]
      let revealed = 0

      while (toReveal.length > 0) {
        const [cx, cy] = toReveal.pop()!
        const cellKey = getKey(cx, cy)
        const cellState = newStates.get(cellKey)

        if (cellState?.revealed || cellState?.flagged) continue

        const isMine = hasMine(cx, cy)

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

        const adjacentMines = countAdjacentMines(cx, cy)

        // If no adjacent mines, reveal neighbors (auto-expand empty areas)
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
    [cellStates, gameState, getKey, seed, density, hasMine, countAdjacentMines],
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
    removedMinesRef.current = new Set()
    isFirstClickRef.current = true
  }, [])

  return {
    getCellState,
    revealCell,
    toggleFlag,
    resetGame,
    gameState,
    revealedCount,
    flaggedCount,
    hasMine,
    countAdjacentMines,
  }
}
