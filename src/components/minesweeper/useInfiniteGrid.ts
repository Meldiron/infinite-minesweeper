import { useState, useCallback, useRef, useEffect } from 'react'

// Sector size for completion tracking
export const SECTOR_SIZE = 8

// Sector states for zoomed-out view
export type SectorState = 'untouched' | 'in-progress' | 'finished'

// Lives system constants
const MAX_LIVES = 5
const REGEN_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes in milliseconds

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

// Get sector coordinates for a cell
export function getSectorCoords(
  x: number,
  y: number,
): { sectorX: number; sectorY: number } {
  return {
    sectorX: Math.floor(x / SECTOR_SIZE),
    sectorY: Math.floor(y / SECTOR_SIZE),
  }
}

export type CellState = {
  revealed: boolean
  flagged: boolean
  exploded?: boolean
}

export type GameState = 'playing' | 'waiting'

export function useInfiniteGrid(seed: number = 12345, density: number = 0.12) {
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(
    new Map(),
  )
  const [gameState, setGameState] = useState<GameState>('playing')
  const [revealedCount, setRevealedCount] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [lastDamageTime, setLastDamageTime] = useState<number | null>(null)
  const [timeUntilNextLife, setTimeUntilNextLife] = useState<number | null>(
    null,
  )

  // Cache for completed sectors
  const [completedSectors, setCompletedSectors] = useState<Set<string>>(
    new Set(),
  )

  // Track removed mines (for first click protection)
  const removedMinesRef = useRef<Set<string>>(new Set())
  const isFirstClickRef = useRef<boolean>(true)

  // Health regeneration effect
  useEffect(() => {
    if (lives >= MAX_LIVES) {
      setTimeUntilNextLife(null)
      return
    }

    if (lastDamageTime === null) {
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const timeSinceLastRegen = now - lastDamageTime
      const timeRemaining =
        REGEN_INTERVAL_MS - (timeSinceLastRegen % REGEN_INTERVAL_MS)

      setTimeUntilNextLife(timeRemaining)

      if (timeSinceLastRegen >= REGEN_INTERVAL_MS) {
        setLives((prev) => {
          const newLives = Math.min(MAX_LIVES, prev + 1)
          if (newLives > 0 && gameState === 'waiting') {
            setGameState('playing')
          }
          // If we're now at max lives, clear the damage time
          // Otherwise, reset it to now to start the next 3-min cycle
          if (newLives >= MAX_LIVES) {
            setLastDamageTime(null)
            setTimeUntilNextLife(null)
          } else {
            setLastDamageTime(now)
          }
          return newLives
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lives, lastDamageTime, gameState])

  const getKey = useCallback((x: number, y: number) => `${x},${y}`, [])

  const getSectorKey = useCallback(
    (sectorX: number, sectorY: number) => `${sectorX},${sectorY}`,
    [],
  )

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

  // Check if a sector is complete (all cells correctly revealed or flagged)
  const checkSectorComplete = useCallback(
    (
      sectorX: number,
      sectorY: number,
      states: Map<string, CellState>,
    ): boolean => {
      const startX = sectorX * SECTOR_SIZE
      const startY = sectorY * SECTOR_SIZE

      for (let dy = 0; dy < SECTOR_SIZE; dy++) {
        for (let dx = 0; dx < SECTOR_SIZE; dx++) {
          const x = startX + dx
          const y = startY + dy
          const key = getKey(x, y)
          const state = states.get(key)
          const isMine = hasMine(x, y)

          if (isMine) {
            // Mine cells must be flagged
            if (!state?.flagged) return false
          } else {
            // Non-mine cells must be revealed
            if (!state?.revealed) return false
          }
        }
      }

      return true
    },
    [getKey, hasMine],
  )

  // Check if a cell's sector is complete
  const isSectorComplete = useCallback(
    (x: number, y: number): boolean => {
      const { sectorX, sectorY } = getSectorCoords(x, y)
      const sectorKey = getSectorKey(sectorX, sectorY)
      return completedSectors.has(sectorKey)
    },
    [completedSectors, getSectorKey],
  )

  // Get the state of a sector (untouched, in-progress, finished)
  const getSectorState = useCallback(
    (sectorX: number, sectorY: number): SectorState => {
      const sectorKey = getSectorKey(sectorX, sectorY)

      // Check if sector is complete
      if (completedSectors.has(sectorKey)) {
        return 'finished'
      }

      // Check if any cell in the sector has been interacted with
      const startX = sectorX * SECTOR_SIZE
      const startY = sectorY * SECTOR_SIZE

      for (let dy = 0; dy < SECTOR_SIZE; dy++) {
        for (let dx = 0; dx < SECTOR_SIZE; dx++) {
          const x = startX + dx
          const y = startY + dy
          const key = getKey(x, y)
          const state = cellStates.get(key)

          if (state?.revealed || state?.flagged) {
            return 'in-progress'
          }
        }
      }

      return 'untouched'
    },
    [cellStates, completedSectors, getKey, getSectorKey],
  )

  // Update completed sectors after state changes
  const updateCompletedSectors = useCallback(
    (newStates: Map<string, CellState>, affectedCells: [number, number][]) => {
      const sectorsToCheck = new Set<string>()

      // Collect all affected sectors
      for (const [x, y] of affectedCells) {
        const { sectorX, sectorY } = getSectorCoords(x, y)
        sectorsToCheck.add(getSectorKey(sectorX, sectorY))
      }

      // Check each affected sector
      const newCompletedSectors = new Set(completedSectors)
      let changed = false

      for (const sectorKey of sectorsToCheck) {
        const [sectorX, sectorY] = sectorKey.split(',').map(Number)
        const isComplete = checkSectorComplete(sectorX, sectorY, newStates)

        if (isComplete && !newCompletedSectors.has(sectorKey)) {
          newCompletedSectors.add(sectorKey)
          changed = true
        } else if (!isComplete && newCompletedSectors.has(sectorKey)) {
          newCompletedSectors.delete(sectorKey)
          changed = true
        }
      }

      if (changed) {
        setCompletedSectors(newCompletedSectors)
      }
    },
    [completedSectors, getSectorKey, checkSectorComplete],
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
      const revealedCells: [number, number][] = []
      let revealed = 0

      while (toReveal.length > 0) {
        const [cx, cy] = toReveal.pop()!
        const cellKey = getKey(cx, cy)
        const cellState = newStates.get(cellKey)

        if (cellState?.revealed || cellState?.flagged) continue

        const isMine = hasMine(cx, cy)

        if (isMine) {
          // Mark the mine as exploded and revealed
          newStates.set(cellKey, {
            revealed: true,
            flagged: false,
            exploded: true,
          })
          setCellStates(newStates)

          // Lose a life
          const newLives = lives - 1
          setLives(newLives)

          // Only set lastDamageTime if this is the first damage (starts the regen timer)
          if (lastDamageTime === null) {
            setLastDamageTime(Date.now())
          }

          if (newLives <= 0) {
            setGameState('waiting')
          }
          return
        }

        newStates.set(cellKey, { revealed: true, flagged: false })
        revealedCells.push([cx, cy])
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

      // Check for sector completion
      if (revealedCells.length > 0) {
        updateCompletedSectors(newStates, revealedCells)
      }
    },
    [
      cellStates,
      gameState,
      getKey,
      seed,
      density,
      hasMine,
      countAdjacentMines,
      getCellState,
      updateCompletedSectors,
      lives,
    ],
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

      // Check for sector completion after flagging
      updateCompletedSectors(newStates, [[x, y]])
    },
    [cellStates, gameState, getKey, updateCompletedSectors],
  )

  const resetGame = useCallback(() => {
    setCellStates(new Map())
    setGameState('playing')
    setRevealedCount(0)
    setFlaggedCount(0)
    setLives(MAX_LIVES)
    setLastDamageTime(null)
    setTimeUntilNextLife(null)
    setCompletedSectors(new Set())
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
    isSectorComplete,
    getSectorState,
    lives,
    maxLives: MAX_LIVES,
    timeUntilNextLife,
  }
}
