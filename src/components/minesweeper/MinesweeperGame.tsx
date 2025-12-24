import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Cell, type MobileInteractionMode } from './Cell'
import {
  GameControls,
  GameInstructions,
  SaveIndicator,
  InteractionModeToggle,
} from './GameControls'
import {
  useInfiniteGrid,
  SECTOR_SIZE,
  type SectorState,
  type InitialSaveData,
} from './useInfiniteGrid'
import { Heart, MapPin } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import {
  saveGameFn,
  deleteGameSaveFn,
  saveUserPreferencesFn,
} from '@/server/functions/minesweeper'
import { useIsMobile } from '@/hooks/use-mobile'

const BASE_CELL_SIZE = 32
const MIN_ZOOM = 0.05
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const SECTOR_VIEW_THRESHOLD = 0.5 // Switch to sector view at 50% zoom or less
const EXPORT_MAX_SIZE = 1000 // Maximum export size in pixels (1000x1000)
const EXPORT_CHUNK_SIZE = 50 // Process 50 rows at a time to prevent freezing
const AUTO_SAVE_DELAY = 3000 // 3 seconds of inactivity before auto-save
const PREFERENCES_SAVE_DELAY = 1000 // 1 second delay for preferences
const DRAG_THRESHOLD = 5 // Pixels moved before considering it a drag

// Detect mobile during initialization (before hooks are available)
const getInitialZoom = () => {
  if (typeof window === 'undefined') return 1
  const isMobileDevice = window.matchMedia('(max-width: 768px)').matches
  return isMobileDevice ? 1.2 : 1
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Type for initial preferences from database
type InitialPreferencesData = {
  id: string
  instructionsOpen: boolean
  interactionMode: string
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
} | null

type MinesweeperGameProps = {
  initialSave?: InitialSaveData
  initialPreferences?: InitialPreferencesData
}

export function MinesweeperGame({
  initialSave,
  initialPreferences,
}: MinesweeperGameProps) {
  const navigate = useNavigate()
  const [seed] = useState(
    () => initialSave?.seed ?? Math.floor(Math.random() * 1000000),
  )

  // Always default zoom to 100% on desktop, 120% on mobile
  const [zoom, setZoom] = useState(getInitialZoom)
  const [offset, setOffset] = useState(() => ({
    x: initialPreferences?.viewportOffsetX ?? initialSave?.viewportOffsetX ?? 0,
    y: initialPreferences?.viewportOffsetY ?? initialSave?.viewportOffsetY ?? 0,
  }))

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [currentSector, setCurrentSector] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [exportProgress, setExportProgress] = useState<number | null>(null)

  // Initialize from preferences if available
  const [instructionsCollapsed, setInstructionsCollapsed] = useState(() =>
    initialPreferences ? !initialPreferences.instructionsOpen : false,
  )
  const [mobileMode, setMobileMode] = useState<MobileInteractionMode>(
    () =>
      (initialPreferences?.interactionMode as MobileInteractionMode) ||
      'default',
  )

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showFlash, setShowFlash] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const preferencesSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMountRef = useRef(true)
  const isMobile = useIsMobile()

  // Track drag state for click prevention
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const dragButtonRef = useRef<number | null>(null)

  const saveGame = useServerFn(saveGameFn)
  const deleteGameSave = useServerFn(deleteGameSaveFn)
  const savePreferences = useServerFn(saveUserPreferencesFn)

  const {
    getCellState,
    revealCell,
    toggleFlag,
    resetGame,
    gameState,
    revealedCount,
    hasMine,
    countAdjacentMines,
    isSectorComplete,
    getSectorState,
    lives,
    maxLives,
    timeUntilNextLife,
    isDirty,
    lastSaveTime,
    getSerializableState,
    markAsSaved,
  } = useInfiniteGrid(seed, 0.15, initialSave)

  // Trigger flash effect for long-press feedback
  const triggerFlash = useCallback(() => {
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 300)
  }, [])

  // Prevent body scroll on mobile when game is mounted
  useEffect(() => {
    const originalStyle = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    const originalHeight = document.body.style.height
    const originalHtmlHeight = document.documentElement.style.height
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width

    // Lock the body to prevent iOS Safari bounce/scroll
    document.documentElement.style.height = '100%'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    document.body.style.height = '100%'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'

    return () => {
      document.documentElement.style.height = originalHtmlHeight
      document.documentElement.style.overflow = originalHtmlOverflow
      document.body.style.overflow = originalStyle
      document.body.style.touchAction = originalTouchAction
      document.body.style.height = originalHeight
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
    }
  }, [])

  // Add native touch event listeners with passive: false to prevent scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault()
    }

    container.addEventListener('touchmove', preventScroll, { passive: false })

    return () => {
      container.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  // Perform save operation
  const performSave = useCallback(async () => {
    if (isSaving) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const state = getSerializableState()
      await saveGame({
        data: {
          ...state,
          viewportOffsetX: offset.x,
          viewportOffsetY: offset.y,
          zoomLevel: zoom,
        },
      })
      markAsSaved()
    } catch (error) {
      console.error('Failed to save game:', error)
      setSaveError('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [getSerializableState, saveGame, markAsSaved, offset, zoom, isSaving])

  // Auto-save effect - triggers 3 seconds after last change
  useEffect(() => {
    if (!isDirty) return

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      performSave()
    }, AUTO_SAVE_DELAY)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [isDirty, performSave])

  // Auto-save preferences when they change
  useEffect(() => {
    // Skip initial mount to avoid unnecessary save
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    // Clear existing timer
    if (preferencesSaveTimerRef.current) {
      clearTimeout(preferencesSaveTimerRef.current)
    }

    // Set new timer for debounced save
    preferencesSaveTimerRef.current = setTimeout(async () => {
      try {
        await savePreferences({
          data: {
            instructionsOpen: !instructionsCollapsed,
            interactionMode: mobileMode,
            viewportOffsetX: offset.x,
            viewportOffsetY: offset.y,
            zoomLevel: zoom,
          },
        })
      } catch (error) {
        console.error('Failed to save preferences:', error)
      }
    }, PREFERENCES_SAVE_DELAY)

    return () => {
      if (preferencesSaveTimerRef.current) {
        clearTimeout(preferencesSaveTimerRef.current)
      }
    }
  }, [
    instructionsCollapsed,
    mobileMode,
    offset.x,
    offset.y,
    zoom,
    savePreferences,
  ])

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

  // Update current sector when cursor moves over game area
  useEffect(() => {
    if (sectorUnderCursor) {
      setCurrentSector(sectorUnderCursor)
    }
  }, [sectorUnderCursor])

  // Calculate sector at center of screen (for mobile)
  const centerSector = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { x: 0, y: 0 }
    }

    // Center of the screen in screen coordinates
    const centerX = containerSize.width / 2
    const centerY = containerSize.height / 2

    // Convert to world position
    const worldX = (centerX - offset.x) / cellSize
    const worldY = (centerY - offset.y) / cellSize

    // Calculate sector coordinates
    const sectorX = Math.floor(worldX / SECTOR_SIZE)
    const sectorY = Math.floor(worldY / SECTOR_SIZE)

    return { x: sectorX, y: sectorY }
  }, [containerSize, offset, cellSize])

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

  // Handle sector click when zoomed out - zoom to 120% centered on clicked sector
  const handleSectorClick = useCallback(
    (sectorX: number, sectorY: number) => {
      // Don't allow click if we just dragged
      if (hasDraggedRef.current) return

      const targetZoom = 1.2 // 120%
      const newCellSize = BASE_CELL_SIZE * targetZoom

      // Calculate the center of the clicked sector in world coordinates
      const sectorCenterX = (sectorX + 0.5) * SECTOR_SIZE * newCellSize
      const sectorCenterY = (sectorY + 0.5) * SECTOR_SIZE * newCellSize

      // Calculate offset to center the sector on screen
      const newOffsetX = containerSize.width / 2 - sectorCenterX
      const newOffsetY = containerSize.height / 2 - sectorCenterY

      setZoom(targetZoom)
      setOffset({ x: newOffsetX, y: newOffsetY })
    },
    [containerSize],
  )

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
        // Track mouse down position for drag detection
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
        hasDraggedRef.current = false
        dragButtonRef.current = 0
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
        // Check if we've moved enough to consider it a drag
        if (mouseDownPosRef.current && dragButtonRef.current === 0) {
          const dx = Math.abs(e.clientX - mouseDownPosRef.current.x)
          const dy = Math.abs(e.clientY - mouseDownPosRef.current.y)
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            hasDraggedRef.current = true
          }
        }

        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Only reset drag state if left button was released
    if (e.button === 0) {
      setIsDragging(false)
      mouseDownPosRef.current = null
      dragButtonRef.current = null
      // Reset hasDragged after a microtask to allow the click event to check it first
      // But we need to reset it so subsequent clicks work
      setTimeout(() => {
        hasDraggedRef.current = false
      }, 0)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setMousePos(null)
    mouseDownPosRef.current = null
    hasDraggedRef.current = false
    dragButtonRef.current = null
  }, [])

  // Check if a click should be allowed (not after a drag)
  const shouldAllowClick = useCallback(() => {
    // If we just finished dragging with left button, block the click
    if (hasDraggedRef.current) {
      return false
    }
    return true
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
  const handleReset = useCallback(async () => {
    // Delete the save from database
    try {
      await deleteGameSave()
    } catch (error) {
      console.error('Failed to delete save:', error)
    }

    resetGame()
    setOffset({ x: 0, y: 0 })
    setZoom(1)
    // Force re-render with new seed by reloading
    window.location.reload()
  }, [resetGame, deleteGameSave])

  // Sign out handler
  const handleSignOut = useCallback(() => {
    navigate({ to: '/sign-out' })
  }, [navigate])

  // Leaderboard handler
  const handleLeaderboard = useCallback(() => {
    navigate({ to: '/leaderboard' })
  }, [navigate])

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
    <div
      className="relative w-full bg-stone-800 overflow-hidden select-none touch-none"
      style={{
        height: '100dvh',
      }}
    >
      {/* Long-press flash effect */}
      {showFlash && (
        <div
          className="absolute inset-0 z-[100] pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 60px 30px rgba(255, 255, 255, 0.35)',
            animation: 'flash-fade 300ms ease-out forwards',
          }}
        />
      )}
      <style>{`
        @keyframes flash-fade {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>

      <GameControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onSignOut={handleSignOut}
        onLeaderboard={handleLeaderboard}
        onResetView={handleResetView}
        gameState={gameState}
        revealedCount={revealedCount}
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

      {/* Save indicator */}
      <SaveIndicator
        isDirty={isDirty}
        isSaving={isSaving}
        lastSaveTime={lastSaveTime}
        error={saveError}
        onForceSave={performSave}
      />

      {/* Mobile interaction mode toggle */}
      <InteractionModeToggle
        mode={mobileMode}
        onToggle={() =>
          setMobileMode((m) => (m === 'default' ? 'reverse' : 'default'))
        }
      />

      {/* Sector position indicator - always visible */}
      <div
        className="absolute right-4 bg-stone-900/95 text-stone-100 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 pointer-events-none z-10"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-amber-500" />
          <span className="font-mono">
            {isMobile ? centerSector.x : currentSector.x},{' '}
            {isMobile ? centerSector.y : currentSector.y}
          </span>
        </div>
      </div>

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
                  isMobile={isMobile}
                  mobileMode={mobileMode}
                  onLongPressAction={triggerFlash}
                  shouldAllowClick={shouldAllowClick}
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
                  className={`absolute ${colors} ${sectorBorderClass} transition-colors duration-200 cursor-pointer hover:brightness-110`}
                  style={{
                    left: sectorX * sectorPixelSize,
                    top: sectorY * sectorPixelSize,
                    width: sectorPixelSize,
                    height: sectorPixelSize,
                  }}
                  onClick={() => handleSectorClick(sectorX, sectorY)}
                />
              )
            })}

          {/* Render sector grid lines - vertical (only when zoomed in) */}
          {!isZoomedOut &&
            sectorLines.vertical.map((x) => (
              <div
                key={`v-${x}`}
                className="absolute bg-stone-400/50 pointer-events-none"
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
                className="absolute bg-stone-400/50 pointer-events-none"
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
