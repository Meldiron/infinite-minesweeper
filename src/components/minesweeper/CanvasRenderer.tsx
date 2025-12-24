import { useRef, useEffect, useCallback, memo } from 'react'
import type { CellState, SectorState } from './useInfiniteGrid'
import { SECTOR_SIZE } from './useInfiniteGrid'
import type { MobileInteractionMode } from './Cell'
import type { RefObject } from 'react'

// Colors for numbers (matching Cell.tsx)
const NUMBER_COLORS: Record<number, string> = {
  1: '#60a5fa', // blue-400
  2: '#4ade80', // green-400
  3: '#f87171', // red-400
  4: '#c084fc', // purple-400
  5: '#fbbf24', // amber-400
  6: '#22d3ee', // cyan-400
  7: '#d6d3d1', // stone-300
  8: '#a8a29e', // stone-400
}

// Number colors for completed sectors (darker for contrast on green)
const NUMBER_COLORS_COMPLETE: Record<number, string> = {
  1: '#1d4ed8', // blue-700
  2: '#166534', // green-800
  3: '#b91c1c', // red-700
  4: '#6b21a8', // purple-800
  5: '#92400e', // amber-800
  6: '#0e7490', // cyan-700
  7: '#1c1917', // stone-900
  8: '#292524', // stone-800
}

// Sector colors
const SECTOR_COLORS: Record<SectorState, { bg: string; border: string }> = {
  untouched: { bg: '#44403c', border: '#57534e' }, // stone-700, stone-600
  'in-progress': { bg: '#b45309', border: '#d97706' }, // amber-700, amber-600
  finished: { bg: '#15803d', border: '#16a34a' }, // green-700, green-600
}

// Cell colors
const CELL_COLORS = {
  unrevealed: {
    normal: {
      bg: '#44403c', // stone-700
      highlight: '#57534e', // stone-600
      shadow: '#1c1917', // stone-900
    },
    complete: {
      bg: '#4ade80', // green-400
      highlight: '#86efac', // green-300
      shadow: '#16a34a', // green-600
    },
  },
  revealed: {
    normal: {
      bg: '#292524', // stone-800
      border: '#44403c', // stone-700
    },
    complete: {
      bg: '#4ade80', // green-400
      border: '#22c55e', // green-500
    },
  },
  mine: {
    normal: {
      bg: '#44403c', // stone-700
      border: '#57534e', // stone-600
      icon: '#a8a29e', // stone-400
    },
    complete: {
      bg: '#22c55e', // green-500
      border: '#16a34a', // green-600
      icon: '#166534', // green-800
    },
  },
  exploded: {
    bg: '#ef4444', // red-500
    border: '#b91c1c', // red-700
    icon: '#ffffff', // white
  },
  flag: {
    normal: '#dc2626', // red-600
    complete: '#166534', // green-800
  },
}

type CanvasRendererProps = {
  width: number
  height: number
  cellSize: number
  offset: { x: number; y: number }
  isZoomedOut: boolean
  zoom: number
  getCellState: (x: number, y: number) => CellState
  hasMine: (x: number, y: number) => boolean
  countAdjacentMines: (x: number, y: number) => number
  isSectorComplete: (x: number, y: number) => boolean
  getSectorState: (sectorX: number, sectorY: number) => SectorState
  onReveal: (x: number, y: number) => void
  onFlag: (x: number, y: number) => void
  onSectorClick: (sectorX: number, sectorY: number) => void
  isMobile: boolean
  mobileMode: MobileInteractionMode
  gameState: 'playing' | 'waiting'
  shouldAllowClick: () => boolean
  onLongPressAction: () => void
  isPinchingRef: RefObject<boolean>
}

export const CanvasRenderer = memo(function CanvasRenderer({
  width,
  height,
  cellSize,
  offset,
  isZoomedOut,
  zoom,
  getCellState,
  hasMine,
  countAdjacentMines,
  isSectorComplete,
  getSectorState,
  onReveal,
  onFlag,
  onSectorClick,
  isMobile,
  mobileMode,
  gameState,
  shouldAllowClick,
  onLongPressAction,
  isPinchingRef,
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  const wasPinchingRef = useRef(false)

  const sectorPixelSize = SECTOR_SIZE * cellSize

  // Draw the grid
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#292524' // stone-800 background
    ctx.fillRect(0, 0, width, height)

    if (isZoomedOut) {
      // Draw sector blocks
      const padding = 1
      const startSectorX = Math.floor(-offset.x / sectorPixelSize) - padding
      const endSectorX =
        Math.ceil((width - offset.x) / sectorPixelSize) + padding
      const startSectorY = Math.floor(-offset.y / sectorPixelSize) - padding
      const endSectorY =
        Math.ceil((height - offset.y) / sectorPixelSize) + padding

      for (let sy = startSectorY; sy <= endSectorY; sy++) {
        for (let sx = startSectorX; sx <= endSectorX; sx++) {
          const state = getSectorState(sx, sy)
          const colors = SECTOR_COLORS[state]

          const x = sx * sectorPixelSize + offset.x
          const y = sy * sectorPixelSize + offset.y

          // Skip if completely outside viewport
          if (
            x + sectorPixelSize < 0 ||
            x > width ||
            y + sectorPixelSize < 0 ||
            y > height
          ) {
            continue
          }

          // Draw sector background
          ctx.fillStyle = colors.bg
          ctx.fillRect(x, y, sectorPixelSize, sectorPixelSize)

          // Draw sector border
          const borderWidth = zoom <= 0.1 ? 1 : 2
          ctx.strokeStyle = colors.border
          ctx.lineWidth = borderWidth
          ctx.strokeRect(
            x + borderWidth / 2,
            y + borderWidth / 2,
            sectorPixelSize - borderWidth,
            sectorPixelSize - borderWidth,
          )
        }
      }
    } else {
      // Draw individual cells
      const padding = 2
      const startX = Math.floor(-offset.x / cellSize) - padding
      const startY = Math.floor(-offset.y / cellSize) - padding
      const endX = Math.ceil((width - offset.x) / cellSize) + padding
      const endY = Math.ceil((height - offset.y) / cellSize) + padding

      const fontSize = Math.max(10, cellSize * 0.5)
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let cy = startY; cy <= endY; cy++) {
        for (let cx = startX; cx <= endX; cx++) {
          const screenX = cx * cellSize + offset.x
          const screenY = cy * cellSize + offset.y

          // Skip if completely outside viewport
          if (
            screenX + cellSize < 0 ||
            screenX > width ||
            screenY + cellSize < 0 ||
            screenY > height
          ) {
            continue
          }

          const state = getCellState(cx, cy)
          const isMineCell = hasMine(cx, cy)
          const adjacentMines = countAdjacentMines(cx, cy)
          const sectorComplete = isSectorComplete(cx, cy)

          const cellWidth = cellSize - 1
          const cellHeight = cellSize - 1

          if (state.revealed) {
            if (state.exploded) {
              // Exploded mine
              ctx.fillStyle = CELL_COLORS.exploded.bg
              ctx.fillRect(screenX, screenY, cellWidth, cellHeight)
              drawBomb(
                ctx,
                screenX + cellWidth / 2,
                screenY + cellHeight / 2,
                cellSize * 0.35,
                CELL_COLORS.exploded.icon,
              )
            } else if (isMineCell) {
              // Revealed mine (not exploded)
              const colors = sectorComplete
                ? CELL_COLORS.mine.complete
                : CELL_COLORS.mine.normal
              ctx.fillStyle = colors.bg
              ctx.fillRect(screenX, screenY, cellWidth, cellHeight)
              drawBomb(
                ctx,
                screenX + cellWidth / 2,
                screenY + cellHeight / 2,
                cellSize * 0.35,
                colors.icon,
              )
            } else {
              // Revealed empty cell
              const colors = sectorComplete
                ? CELL_COLORS.revealed.complete
                : CELL_COLORS.revealed.normal
              ctx.fillStyle = colors.bg
              ctx.fillRect(screenX, screenY, cellWidth, cellHeight)

              // Draw number if adjacent mines > 0
              if (adjacentMines > 0) {
                const numberColors = sectorComplete
                  ? NUMBER_COLORS_COMPLETE
                  : NUMBER_COLORS
                ctx.fillStyle =
                  numberColors[adjacentMines] ||
                  (sectorComplete ? '#14532d' : '#d6d3d1')
                ctx.fillText(
                  String(adjacentMines),
                  screenX + cellWidth / 2,
                  screenY + cellHeight / 2,
                )
              }
            }
          } else if (state.flagged) {
            // Flagged cell
            const colors = sectorComplete
              ? CELL_COLORS.unrevealed.complete
              : CELL_COLORS.unrevealed.normal
            drawUnrevealedCell(
              ctx,
              screenX,
              screenY,
              cellWidth,
              cellHeight,
              colors,
            )
            drawFlag(
              ctx,
              screenX + cellWidth / 2,
              screenY + cellHeight / 2,
              cellSize * 0.35,
              sectorComplete
                ? CELL_COLORS.flag.complete
                : CELL_COLORS.flag.normal,
            )
          } else {
            // Unrevealed cell
            const colors = sectorComplete
              ? CELL_COLORS.unrevealed.complete
              : CELL_COLORS.unrevealed.normal
            drawUnrevealedCell(
              ctx,
              screenX,
              screenY,
              cellWidth,
              cellHeight,
              colors,
            )
          }
        }
      }

      // Draw sector grid lines
      const sectorLineColor = 'rgba(168, 162, 158, 0.5)' // stone-400/50
      ctx.strokeStyle = sectorLineColor
      ctx.lineWidth = 2

      // Vertical lines
      const startSectorX = Math.floor(-offset.x / sectorPixelSize) - 1
      const endSectorX = Math.ceil((width - offset.x) / sectorPixelSize) + 1
      for (let sx = startSectorX; sx <= endSectorX; sx++) {
        const lineX = sx * sectorPixelSize + offset.x
        ctx.beginPath()
        ctx.moveTo(lineX, 0)
        ctx.lineTo(lineX, height)
        ctx.stroke()
      }

      // Horizontal lines
      const startSectorY = Math.floor(-offset.y / sectorPixelSize) - 1
      const endSectorY = Math.ceil((height - offset.y) / sectorPixelSize) + 1
      for (let sy = startSectorY; sy <= endSectorY; sy++) {
        const lineY = sy * sectorPixelSize + offset.y
        ctx.beginPath()
        ctx.moveTo(0, lineY)
        ctx.lineTo(width, lineY)
        ctx.stroke()
      }
    }
  }, [
    width,
    height,
    cellSize,
    offset,
    isZoomedOut,
    zoom,
    sectorPixelSize,
    getCellState,
    hasMine,
    countAdjacentMines,
    isSectorComplete,
    getSectorState,
  ])

  // Redraw on any relevant change
  useEffect(() => {
    draw()
  }, [draw])

  // Convert screen coordinates to cell/sector coordinates
  const screenToCell = useCallback(
    (screenX: number, screenY: number) => {
      const worldX = screenX - offset.x
      const worldY = screenY - offset.y
      return {
        cellX: Math.floor(worldX / cellSize),
        cellY: Math.floor(worldY / cellSize),
        sectorX: Math.floor(worldX / sectorPixelSize),
        sectorY: Math.floor(worldY / sectorPixelSize),
      }
    },
    [offset, cellSize, sectorPixelSize],
  )

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (gameState !== 'playing') return
      if (!shouldAllowClick()) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const { cellX, cellY, sectorX, sectorY } = screenToCell(screenX, screenY)

      if (isZoomedOut) {
        onSectorClick(sectorX, sectorY)
      } else {
        const state = getCellState(cellX, cellY)
        if (mobileMode === 'default') {
          if (!state.flagged) {
            onReveal(cellX, cellY)
          }
        } else {
          if (!state.revealed) {
            onFlag(cellX, cellY)
          }
        }
      }
    },
    [
      gameState,
      shouldAllowClick,
      screenToCell,
      isZoomedOut,
      onSectorClick,
      getCellState,
      mobileMode,
      onReveal,
      onFlag,
    ],
  )

  // Handle right click (context menu)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (gameState !== 'playing') return
      if (!shouldAllowClick()) return
      if (isZoomedOut) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const { cellX, cellY } = screenToCell(screenX, screenY)

      const state = getCellState(cellX, cellY)
      if (mobileMode === 'default') {
        if (!state.revealed) {
          onFlag(cellX, cellY)
        }
      } else {
        if (!state.flagged) {
          onReveal(cellX, cellY)
        }
      }
    },
    [
      gameState,
      shouldAllowClick,
      isZoomedOut,
      screenToCell,
      getCellState,
      mobileMode,
      onFlag,
      onReveal,
    ],
  )

  // Mobile touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || gameState !== 'playing') return
      if (isZoomedOut) return

      // If pinching or multiple touches, don't start long press
      if (isPinchingRef.current || e.touches.length > 1) {
        wasPinchingRef.current = true
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
        return
      }

      const touch = e.touches[0]
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      isLongPressRef.current = false
      hasMovedRef.current = false
      wasPinchingRef.current = false

      const screenX = touch.clientX - rect.left
      const screenY = touch.clientY - rect.top
      const { cellX, cellY } = screenToCell(screenX, screenY)

      longPressTimerRef.current = setTimeout(() => {
        // Double-check we're not pinching when timer fires
        if (isPinchingRef.current || wasPinchingRef.current) {
          return
        }

        isLongPressRef.current = true
        onLongPressAction()

        const state = getCellState(cellX, cellY)
        if (mobileMode === 'default') {
          if (!state.revealed) {
            onFlag(cellX, cellY)
          }
        } else {
          if (!state.flagged) {
            onReveal(cellX, cellY)
          }
        }
      }, 500)
    },
    [
      isMobile,
      gameState,
      isZoomedOut,
      isPinchingRef,
      screenToCell,
      getCellState,
      mobileMode,
      onFlag,
      onReveal,
      onLongPressAction,
    ],
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if multiple fingers detected (pinch starting)
    if (e.touches.length > 1) {
      wasPinchingRef.current = true
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      return
    }

    if (!touchStartPosRef.current) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)

    if (dx > 10 || dy > 10) {
      hasMovedRef.current = true
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || gameState !== 'playing') return

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isLongPressRef.current) {
      isLongPressRef.current = false
      touchStartPosRef.current = null
      hasMovedRef.current = false
      wasPinchingRef.current = false
      return
    }

    if (
      hasMovedRef.current ||
      wasPinchingRef.current ||
      isPinchingRef.current
    ) {
      touchStartPosRef.current = null
      hasMovedRef.current = false
      wasPinchingRef.current = false
      return
    }

    // Handle tap
    if (touchStartPosRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const screenX = touchStartPosRef.current.x - rect.left
        const screenY = touchStartPosRef.current.y - rect.top

        if (isZoomedOut) {
          const { sectorX, sectorY } = screenToCell(screenX, screenY)
          onSectorClick(sectorX, sectorY)
        } else {
          const { cellX, cellY } = screenToCell(screenX, screenY)
          const state = getCellState(cellX, cellY)

          if (mobileMode === 'default') {
            if (!state.flagged) {
              onReveal(cellX, cellY)
            }
          } else {
            if (!state.revealed) {
              onFlag(cellX, cellY)
            }
          }
        }
      }
    }

    touchStartPosRef.current = null
    hasMovedRef.current = false
    wasPinchingRef.current = false
  }, [
    isMobile,
    gameState,
    isPinchingRef,
    isZoomedOut,
    screenToCell,
    getCellState,
    mobileMode,
    onReveal,
    onFlag,
    onSectorClick,
  ])

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    isLongPressRef.current = false
    touchStartPosRef.current = null
    hasMovedRef.current = false
    wasPinchingRef.current = false
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ touchAction: 'none' }}
      onClick={isMobile ? undefined : handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    />
  )
})

// Helper function to draw unrevealed cell with 3D effect
function drawUnrevealedCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: { bg: string; highlight: string; shadow: string },
) {
  // Main background
  ctx.fillStyle = colors.bg
  ctx.fillRect(x, y, width, height)

  // Top and left highlight (lighter)
  ctx.fillStyle = colors.highlight
  ctx.fillRect(x, y, width, 2)
  ctx.fillRect(x, y, 2, height)

  // Bottom and right shadow (darker)
  ctx.fillStyle = colors.shadow
  ctx.fillRect(x, y + height - 2, width, 2)
  ctx.fillRect(x + width - 2, y, 2, height)
}

// Helper function to draw a bomb icon
function drawBomb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.15

  // Main circle
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2)
  ctx.fill()

  // Spikes
  const spikeLength = size * 0.35
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    ctx.beginPath()
    ctx.moveTo(
      cx + Math.cos(angle) * size * 0.4,
      cy + Math.sin(angle) * size * 0.4,
    )
    ctx.lineTo(
      cx + Math.cos(angle) * (size * 0.4 + spikeLength),
      cy + Math.sin(angle) * (size * 0.4 + spikeLength),
    )
    ctx.stroke()
  }

  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.beginPath()
  ctx.arc(cx - size * 0.15, cy - size * 0.15, size * 0.15, 0, Math.PI * 2)
  ctx.fill()
}

// Helper function to draw a flag icon
function drawFlag(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color

  // Pole
  const poleX = cx - size * 0.1
  const poleTop = cy - size * 0.5
  const poleBottom = cy + size * 0.5
  ctx.lineWidth = size * 0.12
  ctx.beginPath()
  ctx.moveTo(poleX, poleTop)
  ctx.lineTo(poleX, poleBottom)
  ctx.stroke()

  // Flag triangle
  ctx.beginPath()
  ctx.moveTo(poleX, poleTop)
  ctx.lineTo(poleX + size * 0.6, poleTop + size * 0.3)
  ctx.lineTo(poleX, poleTop + size * 0.6)
  ctx.closePath()
  ctx.fill()

  // Base
  ctx.fillRect(
    cx - size * 0.35,
    poleBottom - size * 0.1,
    size * 0.5,
    size * 0.15,
  )
}
