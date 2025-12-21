import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Cell } from './Cell'
import { GameControls, GameInstructions } from './GameControls'
import {
  useInfiniteGrid,
  SECTOR_SIZE,
  type SectorState,
} from './useInfiniteGrid'

const BASE_CELL_SIZE = 32
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const SECTOR_VIEW_THRESHOLD = 0.5 // Switch to sector view at 50% zoom or less

export type Theme = 'light' | 'dark'

export function MinesweeperGame() {
  const [seed] = useState(() => Math.floor(Math.random() * 1000000))
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [theme, setTheme] = useState<Theme>('dark')
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
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta))

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

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  // Reset game with new seed
  const handleReset = useCallback(() => {
    resetGame()
    setOffset({ x: 0, y: 0 })
    setZoom(1)
    // Force re-render with new seed by reloading
    window.location.reload()
  }, [resetGame])

  const bgColor = theme === 'dark' ? 'bg-stone-800' : 'bg-stone-300'
  const sectorLineColor =
    theme === 'dark' ? 'bg-amber-500/60' : 'bg-amber-600/70'

  // Sector colors based on state and theme
  const getSectorColors = (state: SectorState): string => {
    if (theme === 'dark') {
      switch (state) {
        case 'untouched':
          return 'bg-stone-700 border-stone-600'
        case 'in-progress':
          return 'bg-amber-700 border-amber-600'
        case 'finished':
          return 'bg-green-700 border-green-600'
      }
    } else {
      switch (state) {
        case 'untouched':
          return 'bg-stone-400 border-stone-500'
        case 'in-progress':
          return 'bg-amber-400 border-amber-500'
        case 'finished':
          return 'bg-green-400 border-green-500'
      }
    }
  }

  return (
    <div
      className={`relative w-full h-screen ${bgColor} overflow-hidden select-none transition-colors duration-300`}
    >
      <GameControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onResetView={handleResetView}
        gameState={gameState}
        revealedCount={revealedCount}
        flaggedCount={flaggedCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <GameInstructions theme={theme} />

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
                  gameOver={gameState === 'lost'}
                  theme={theme}
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
                  className={`absolute ${colors} border-2 transition-colors duration-200`}
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
                className={`absolute ${sectorLineColor} pointer-events-none`}
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
                className={`absolute ${sectorLineColor} pointer-events-none`}
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
