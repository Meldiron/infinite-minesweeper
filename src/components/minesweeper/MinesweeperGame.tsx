import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Cell } from './Cell'
import { GameControls, GameInstructions } from './GameControls'
import {
  useInfiniteGrid,
  SECTOR_SIZE,
  type SectorState,
} from './useInfiniteGrid'
import { Heart, MapPin } from 'lucide-react'

const BASE_CELL_SIZE = 32
const MIN_ZOOM = 0.05
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const SECTOR_VIEW_THRESHOLD = 0.5 // Switch to sector view at 50% zoom or less
const EXPORT_MAX_SIZE = 1000 // Maximum export size in pixels (1000x1000)
const EXPORT_CHUNK_SIZE = 50 // Process 50 rows at a time to prevent freezing

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function MinesweeperGame() {
  const [seed] = useState(() => Math.floor(Math.random() * 1000000))
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [instructionsCollapsed, setInstructionsCollapsed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
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
    maxLives,
    timeUntilNextLife,
  } = useInfiniteGrid(seed, 0.15)

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const cellSize = BASE_CELL_SIZE * zoom
  const sectorPixelSize = SECTOR_SIZE * cellSize
  const isZoomedOut = zoom <= SECTOR_VIEW_THRESHOLD

  // Calculate sector position under cursor
  const sectorUnderCursor = useMemo(() => {
    if (!mousePos) return null

    // Convert screen position to world position
    const worldX = (mousePos.x - offset.x) / cellSize
    const worldY = (mousePos.y - offset.y) / cellSize

    // Calculate sector coordinates
    const sectorX = Math.floor(worldX / SECTOR_SIZE)
    const sectorY = Math.floor(worldY / SECTOR_SIZE)

    return { x: sectorX, y: sectorY }
  }, [mousePos, offset, cellSize])

  // Export board as PNG (1 pixel per sector, max 1000x1000, centered at 0,0)
  // Uses chunked processing to prevent browser freezing
  const handleExportPNG = useCallback(async () => {
    // Prevent multiple exports at once
    if (exportProgress !== null) return

    setExportProgress(0)

    const canvas = document.createElement('canvas')
    canvas.width = EXPORT_MAX_SIZE
    canvas.height = EXPORT_MAX_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setExportProgress(null)
      return
    }

    // Fill with untouched color (dark gray)
    ctx.fillStyle = '#44403c' // stone-700
    ctx.fillRect(0, 0, EXPORT_MAX_SIZE, EXPORT_MAX_SIZE)

    // Calculate sector range (centered at 0,0)
    const halfSize = Math.floor(EXPORT_MAX_SIZE / 2)
    const minSectorX = -halfSize
    const minSectorY = -halfSize

    // Color mapping for sector states
    const sectorColors: Record<SectorState, string> = {
      untouched: '#44403c', // stone-700
      'in-progress': '#b45309', // amber-700
      finished: '#15803d', // green-700
    }

    // Process in chunks to prevent freezing
    const totalRows = EXPORT_MAX_SIZE
    let currentRow = 0

    const processChunk = (): Promise<void> => {
      return new Promise((resolve) => {
        const endRow = Math.min(currentRow + EXPORT_CHUNK_SIZE, totalRows)

        for (let py = currentRow; py < endRow; py++) {
          for (let px = 0; px < EXPORT_MAX_SIZE; px++) {
            const sectorX = minSectorX + px
            const sectorY = minSectorY + py
            const state = getSectorState(sectorX, sectorY)

            // Only draw if not untouched (untouched is already the background)
            if (state !== 'untouched') {
              ctx.fillStyle = sectorColors[state]
              ctx.fillRect(px, py, 1, 1)
            }
          }
        }

        currentRow = endRow
        setExportProgress(Math.round((currentRow / totalRows) * 100))

        // Yield to browser using requestAnimationFrame
        requestAnimationFrame(() => resolve())
      })
    }

    // Process all chunks
    while (currentRow < totalRows) {
      await processChunk()
    }

    // Convert to PNG and download
    canvas.toBlob((blob) => {
      if (!blob) {
        setExportProgress(null)
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `minesweeper-map-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportProgress(null)
    }, 'image/png')
  }, [getSectorState, exportProgress])

  // Check if at minimum zoom (5%)
  const isAtMinZoom = zoom <= 0.05

  // Calculate visible cells (only when not in sector view)
  const visibleCells = useMemo(() => {
    if (isZoomedOut) return []
    if (containerSize.width === 0 || containerSize.height === 0) return []

    const padding = 2 // Extra cells to render outside viewport
    const startX = Math.floor(-offset.x / cellSize) - padding
    const startY = Math.floor(-offset.y / cellSize) - padding
    const endX =
      Math.ceil((containerSize.width - offset.x) / cellSize) + padding
    const endY =
      Math.ceil((containerSize.height - offset.y) / cellSize) + padding

    const cells: { x: number; y: number }[] = []
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        cells.push({ x, y })
      }
    }
    return cells
  }, [containerSize, offset, cellSize, isZoomedOut])

  // Calculate visible sectors (only when in sector view)
  const visibleSectors = useMemo(() => {
    if (!isZoomedOut) return []
    if (containerSize.width === 0 || containerSize.height === 0) return []

    const padding = 1
    const startSectorX = Math.floor(-offset.x / sectorPixelSize) - padding
    const endSectorX =
      Math.ceil((containerSize.width - offset.x) / sectorPixelSize) + padding
    const startSectorY = Math.floor(-offset.y / sectorPixelSize) - padding
    const endSectorY =
      Math.ceil((containerSize.height - offset.y) / sectorPixelSize) + padding

    const sectors: { sectorX: number; sectorY: number }[] = []
    for (let sy = startSectorY; sy <= endSectorY; sy++) {
      for (let sx = startSectorX; sx <= endSectorX; sx++) {
        sectors.push({ sectorX: sx, sectorY: sy })
      }
    }
    return sectors
  }, [containerSize, offset, sectorPixelSize, isZoomedOut])

  // Calculate visible sector grid lines
  const sectorLines = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { vertical: [], horizontal: [] }
    }

    const padding = 1
    // Calculate sector boundaries in sector coordinates
    const startSectorX = Math.floor(-offset.x / sectorPixelSize) - padding
    const endSectorX =
      Math.ceil((containerSize.width - offset.x) / sectorPixelSize) + padding
    const startSectorY = Math.floor(-offset.y / sectorPixelSize) - padding
    const endSectorY =
      Math.ceil((containerSize.height - offset.y) / sectorPixelSize) + padding

    const vertical: number[] = []
    const horizontal: number[] = []

    for (let sx = startSectorX; sx <= endSectorX; sx++) {
      vertical.push(sx * sectorPixelSize)
    }

    for (let sy = startSectorY; sy <= endSectorY; sy++) {
      horizontal.push(sy * sectorPixelSize)
    }

    return { vertical, horizontal }
  }, [containerSize, offset, sectorPixelSize])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      // If at 5%, jump to 10%
      if (z <= 0.05) return 0.1
      return Math.min(MAX_ZOOM, z + ZOOM_STEP)
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      // If at 10% or between 5-10%, go to 5%
      if (z <= 0.1 && z > 0.05) return 0.05
      // If already at 5%, stay there
      if (z <= 0.05) return MIN_ZOOM
      return Math.max(MIN_ZOOM, z - ZOOM_STEP)
    })
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      let newZoom: number
      if (e.deltaY > 0) {
        // Zooming out
        if (zoom <= 0.1 && zoom > 0.05) {
          newZoom = 0.05
        } else if (zoom <= 0.05) {
          newZoom = MIN_ZOOM
        } else {
          newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP)
        }
      } else {
        // Zooming in
        if (zoom <= 0.05) {
          newZoom = 0.1
        } else {
          newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP)
        }
      }

      // Zoom towards mouse position
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const zoomRatio = newZoom / zoom
        const newOffsetX = mouseX - (mouseX - offset.x) * zoomRatio
        const newOffsetY = mouseY - (mouseY - offset.y) * zoomRatio

        setOffset({ x: newOffsetX, y: newOffsetY })
      }

      setZoom(newZoom)
    },
    [zoom, offset],
  )

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // Left click
        setIsDragging(true)
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
      }
    },
    [offset],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Update mouse position for sector tracking
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }

      if (isDragging) {
        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setMousePos(null)
  }, [])

  // Touch handlers for mobile
  const touchStartRef = useRef<{
    x: number
    y: number
    distance?: number
  } | null>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX - offset.x,
          y: e.touches[0].clientY - offset.y,
        }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchStartRef.current = {
          x: offset.x,
          y: offset.y,
          distance: Math.sqrt(dx * dx + dy * dy),
        }
      }
    },
    [offset],
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    if (e.touches.length === 1 && !touchStartRef.current.distance) {
      setOffset({
        x: e.touches[0].clientX - touchStartRef.current.x,
        y: e.touches[0].clientY - touchStartRef.current.y,
      })
    } else if (e.touches.length === 2 && touchStartRef.current.distance) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const scale = distance / touchStartRef.current.distance
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * scale)))
      touchStartRef.current.distance = distance
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
  }, [])

  // Reset game with new seed
  const handleReset = useCallback(() => {
    resetGame()
    setOffset({ x: 0, y: 0 })
    setZoom(1)
    // Force re-render with new seed by reloading
    window.location.reload()
  }, [resetGame])

  // Sector colors based on state (dark theme only)
  const getSectorColors = (state: SectorState): string => {
    switch (state) {
      case 'untouched':
        return 'bg-stone-700 border-stone-600'
      case 'in-progress':
        return 'bg-amber-700 border-amber-600'
      case 'finished':
        return 'bg-green-700 border-green-600'
    }
  }

  const isWaiting = gameState === 'waiting'

  // Thinner borders at very low zoom levels
  const sectorBorderClass = zoom <= 0.1 ? 'border' : 'border-2'

  return (
    <div className="relative w-full h-screen bg-stone-800 overflow-hidden select-none">
      <GameControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onResetView={handleResetView}
        gameState={gameState}
        revealedCount={revealedCount}
        flaggedCount={flaggedCount}
        lives={lives}
        maxLives={maxLives}
        timeUntilNextLife={timeUntilNextLife}
        onExportPNG={handleExportPNG}
        isAtMinZoom={isAtMinZoom}
        exportProgress={exportProgress}
      />

      <GameInstructions
        isCollapsed={instructionsCollapsed}
        onToggleCollapse={() => setInstructionsCollapsed((prev) => !prev)}
      />

      {/* Sector position indicator */}
      {sectorUnderCursor && (
        <div className="absolute bottom-4 right-4 bg-stone-900/95 text-stone-100 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-amber-500" />
            <span className="font-mono text-sm">
              Sector ({sectorUnderCursor.x}, {sectorUnderCursor.y})
            </span>
          </div>
        </div>
      )}

      {/* Waiting overlay when out of lives */}
      {isWaiting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-stone-900 rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="flex justify-center mb-4">
              <Heart size={64} className="text-stone-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Out of Lives!
            </h2>
            <p className="text-stone-400 mb-6">
              Wait for your health to regenerate to continue playing.
            </p>
            {timeUntilNextLife !== null && (
              <div className="bg-stone-800 rounded-lg p-4">
                <p className="text-stone-400 text-sm mb-1">Next life in</p>
                <p className="text-3xl font-mono font-bold text-red-400">
                  {formatTime(timeUntilNextLife)}
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-1">
              {Array.from({ length: maxLives }).map((_, i) => (
                <Heart
                  key={i}
                  size={24}
                  className={
                    i < lives ? 'text-red-500 fill-red-500' : 'text-stone-600'
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            willChange: 'transform',
          }}
        >
          {/* Render cells when zoomed in */}
          {!isZoomedOut &&
            visibleCells.map(({ x, y }) => {
              const state = getCellState(x, y)
              const isMine = hasMine(x, y)
              const adjacentMines = countAdjacentMines(x, y)
              const sectorComplete = isSectorComplete(x, y)

              return (
                <Cell
                  key={`${x},${y}`}
                  x={x}
                  y={y}
                  size={cellSize}
                  state={state}
                  isMine={isMine}
                  adjacentMines={adjacentMines}
                  onReveal={revealCell}
                  onFlag={toggleFlag}
                  gameOver={false}
                  sectorComplete={sectorComplete}
                />
              )
            })}

          {/* Render sector blocks when zoomed out */}
          {isZoomedOut &&
            visibleSectors.map(({ sectorX, sectorY }) => {
              const state = getSectorState(sectorX, sectorY)
              const colors = getSectorColors(state)

              return (
                <div
                  key={`sector-${sectorX},${sectorY}`}
                  className={`absolute ${colors} ${sectorBorderClass} transition-colors duration-200`}
                  style={{
                    left: sectorX * sectorPixelSize,
                    top: sectorY * sectorPixelSize,
                    width: sectorPixelSize,
                    height: sectorPixelSize,
                  }}
                />
              )
            })}

          {/* Render sector grid lines - vertical (only when zoomed in) */}
          {!isZoomedOut &&
            sectorLines.vertical.map((x) => (
              <div
                key={`v-${x}`}
                className="absolute bg-amber-500/60 pointer-events-none"
                style={{
                  left: x,
                  top: -10000,
                  width: 2,
                  height: 20000,
                }}
              />
            ))}

          {/* Render sector grid lines - horizontal (only when zoomed in) */}
          {!isZoomedOut &&
            sectorLines.horizontal.map((y) => (
              <div
                key={`h-${y}`}
                className="absolute bg-amber-500/60 pointer-events-none"
                style={{
                  left: -10000,
                  top: y,
                  width: 20000,
                  height: 2,
                }}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
