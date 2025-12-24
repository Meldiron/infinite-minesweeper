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

// Serializable game state for persistence
export type SerializableGameState = {
  cellStates: string
  removedMines: string | null
  completedSectors: string | null
  isFirstClick: boolean
  gameOver: boolean
  seed: number
  health: number | null
  healthRegenTimestamp: string | null
}

// Helper to serialize Map to JSON string
function serializeCellStates(states: Map<string, CellState>): string {
  const obj: Record<string, CellState> = {}
  states.forEach((value, key) => {
    obj[key] = value
  })
  return JSON.stringify(obj)
}

// Helper to deserialize JSON string to Map
function deserializeCellStates(json: string): Map<string, CellState> {
  try {
    const obj = JSON.parse(json) as Record<string, CellState>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

// Helper to serialize Set to JSON string
function serializeSet(set: Set<string>): string {
  return JSON.stringify(Array.from(set))
}

// Helper to deserialize JSON string to Set
function deserializeSet(json: string | null): Set<string> {
  if (!json) return new Set()
  try {
    const arr = JSON.parse(json) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

export type InitialSaveData = {
  cellStates: string
  removedMines: string | null
  completedSectors: string | null
  isFirstClick: boolean
  gameOver: boolean
  viewportOffsetX?: number | null
  viewportOffsetY?: number | null
  zoomLevel?: number | null
  seed?: number | null
  health?: number | null
  healthRegenTimestamp?: string | null
  updatedAt?: string | null
} | null

export function useInfiniteGrid(
  seed: number = 12345,
  density: number = 0.12,
  initialSave?: InitialSaveData,
) {
  // Initialize state from save data if available
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(() => {
    if (initialSave?.cellStates) {
      return deserializeCellStates(initialSave.cellStates)
    }
    return new Map()
  })

  const [gameState, setGameState] = useState<GameState>(() => {
    // Check if game should be in waiting state (either gameOver flag or no lives)
    if (initialSave?.gameOver) return 'waiting'
    if (
      initialSave?.health !== undefined &&
      initialSave?.health !== null &&
      initialSave.health <= 0
    ) {
      return 'waiting'
    }
    return 'playing'
  })

  const [revealedCount, setRevealedCount] = useState(() => {
    if (initialSave?.cellStates) {
      const states = deserializeCellStates(initialSave.cellStates)
      let count = 0
      states.forEach((state) => {
        if (state.revealed && !state.exploded) count++
      })
      return count
    }
    return 0
  })

  const [flaggedCount, setFlaggedCount] = useState(() => {
    if (initialSave?.cellStates) {
      const states = deserializeCellStates(initialSave.cellStates)
      let count = 0
      states.forEach((state) => {
        if (state.flagged) count++
      })
      return count
    }
    return 0
  })

  // Initialize lives from save data, default to MAX_LIVES
  const [lives, setLives] = useState(() => {
    if (initialSave?.health !== undefined && initialSave?.health !== null) {
      return initialSave.health
    }
    return MAX_LIVES
  })

  // Initialize lastDamageTime from save data (stored as ISO string)
  const [lastDamageTime, setLastDamageTime] = useState<number | null>(() => {
    if (initialSave?.healthRegenTimestamp) {
      const timestamp = new Date(initialSave.healthRegenTimestamp).getTime()
      // Validate the timestamp is reasonable (not NaN and not in the future by too much)
      if (!isNaN(timestamp)) {
        return timestamp
      }
    }
    return null
  })

  const [timeUntilNextLife, setTimeUntilNextLife] = useState<number | null>(
    null,
  )

  // Cache for completed sectors
  const [completedSectors, setCompletedSectors] = useState<Set<string>>(() => {
    if (initialSave?.completedSectors) {
      return deserializeSet(initialSave.completedSectors)
    }
    return new Set()
  })

  // Track removed mines (for first click protection) - using state for proper serialization
  const [removedMines, setRemovedMines] = useState<Set<string>>(() => {
    if (initialSave?.removedMines) {
      return deserializeSet(initialSave.removedMines)
    }
    return new Set()
  })
  const isFirstClickRef = useRef<boolean>(initialSave?.isFirstClick ?? true)

  // Track if state has changed since last save
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null)

  // Track initial mount to avoid marking dirty on load
  const isInitialHealthMountRef = useRef(true)

  // Track if offline regeneration has been processed
  const hasProcessedOfflineRegenRef = useRef(false)

  // Mark as dirty when health state changes (but not on initial mount)
  useEffect(() => {
    if (isInitialHealthMountRef.current) {
      isInitialHealthMountRef.current = false
      return
    }
    setIsDirty(true)
  }, [lives, lastDamageTime])

  // Handle health regeneration that occurred while game was closed
  useEffect(() => {
    // Only run once
    if (hasProcessedOfflineRegenRef.current) return
    hasProcessedOfflineRegenRef.current = true

    if (
      !initialSave?.healthRegenTimestamp ||
      initialSave?.health === undefined ||
      initialSave?.health === null
    ) {
      return
    }

    const savedTimestamp = new Date(initialSave.healthRegenTimestamp).getTime()
    if (isNaN(savedTimestamp)) return

    const now = Date.now()
    const timePassed = now - savedTimestamp

    // Calculate how many lives should have regenerated
    const livesRegenerated = Math.floor(timePassed / REGEN_INTERVAL_MS)

    if (livesRegenerated > 0) {
      const newLives = Math.min(
        MAX_LIVES,
        initialSave.health + livesRegenerated,
      )
      setLives(newLives)

      if (newLives >= MAX_LIVES) {
        // Fully healed, clear the damage time
        setLastDamageTime(null)
        setGameState('playing')
      } else {
        // Still regenerating, update the timestamp to account for partial progress
        const remainingTime = timePassed % REGEN_INTERVAL_MS
        setLastDamageTime(now - remainingTime)
        if (newLives > 0) {
          setGameState('playing')
        }
      }

      // Mark as dirty since we updated health
      setIsDirty(true)
    }
  }, [initialSave])

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
      if (removedMines.has(key)) return false
      return hasMineBase(x, y, seed, density)
    },
    [getKey, seed, density, removedMines],
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

  // Check if a sector is complete (all non-mine cells revealed, mines either flagged or exploded)
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
            // Mine cells must be either flagged or exploded (clicked)
            if (!state?.flagged && !state?.exploded) return false
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

        const minesToRemove = new Set<string>()

        // Remove mine from clicked cell
        if (hasMineBase(x, y, seed, density)) {
          minesToRemove.add(key)
        }

        // Remove mines from immediate neighbors (8 cells)
        const immediateNeighbors = getNeighbors(x, y)
        for (const [nx, ny] of immediateNeighbors) {
          const neighborKey = getKey(nx, ny)
          if (hasMineBase(nx, ny, seed, density)) {
            minesToRemove.add(neighborKey)
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
            minesToRemove.add(neighborKey)
          }
        }

        // Update removed mines state
        if (minesToRemove.size > 0) {
          setRemovedMines((prev) => {
            const newSet = new Set(prev)
            minesToRemove.forEach((k) => newSet.add(k))
            return newSet
          })
        }

        // Create a local hasMine function that includes the newly removed mines
        // This is needed because state updates are async and hasMine won't see the new removedMines yet
        const hasMineLocal = (cx: number, cy: number): boolean => {
          const cellKey = getKey(cx, cy)
          if (removedMines.has(cellKey) || minesToRemove.has(cellKey))
            return false
          return hasMineBase(cx, cy, seed, density)
        }

        // Count adjacent mines with local removed mines
        const countAdjacentMinesLocal = (cx: number, cy: number): number => {
          return getNeighbors(cx, cy).filter(([nx, ny]) => hasMineLocal(nx, ny))
            .length
        }

        // Perform reveal with local mine checking
        const newStates = new Map(cellStates)
        const toReveal: [number, number][] = [[x, y]]
        const revealedCells: [number, number][] = []
        let revealed = 0

        while (toReveal.length > 0) {
          const [cx, cy] = toReveal.pop()!
          const cellKey = getKey(cx, cy)
          const cellState = newStates.get(cellKey)

          if (cellState?.revealed || cellState?.flagged) continue

          const isMine = hasMineLocal(cx, cy)

          if (isMine) {
            // This shouldn't happen on first click due to mine removal, but handle it anyway
            newStates.set(cellKey, {
              revealed: true,
              flagged: false,
              exploded: true,
            })
            setCellStates(newStates)
            setIsDirty(true)
            updateCompletedSectors(newStates, [[cx, cy]])
            const newLives = lives - 1
            setLives(newLives)
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

          const adjacentMines = countAdjacentMinesLocal(cx, cy)

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
        setIsDirty(true)

        if (revealedCells.length > 0) {
          updateCompletedSectors(newStates, revealedCells)
        }
        return
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
          setIsDirty(true)

          // Check for sector completion after mine explosion
          updateCompletedSectors(newStates, [[cx, cy]])

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
      setIsDirty(true)

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
      lastDamageTime,
      removedMines,
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
      setIsDirty(true)

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
    setRemovedMines(new Set())
    isFirstClickRef.current = true
    setIsDirty(true)
    setLastSaveTime(null)
  }, [])

  // Get serializable state for saving
  const getSerializableState = useCallback((): SerializableGameState => {
    return {
      cellStates: serializeCellStates(cellStates),
      removedMines: removedMines.size > 0 ? serializeSet(removedMines) : null,
      completedSectors:
        completedSectors.size > 0 ? serializeSet(completedSectors) : null,
      isFirstClick: isFirstClickRef.current,
      gameOver: gameState === 'waiting',
      seed,
      health: lives,
      healthRegenTimestamp: lastDamageTime
        ? new Date(lastDamageTime).toISOString()
        : null,
    }
  }, [
    cellStates,
    completedSectors,
    gameState,
    removedMines,
    seed,
    lives,
    lastDamageTime,
  ])

  // Mark as saved
  const markAsSaved = useCallback(() => {
    setIsDirty(false)
    setLastSaveTime(Date.now())
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
    // Persistence helpers
    isDirty,
    lastSaveTime,
    getSerializableState,
    markAsSaved,
  }
}
