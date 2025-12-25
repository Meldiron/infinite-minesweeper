import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CanvasRenderer } from './CanvasRenderer'
import type { MobileInteractionMode } from './Cell'
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
import {
  Heart,
  MapPin,
  CloudOff,
  Cloud,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import {
  saveGameFn,
  deleteGameSaveFn,
  saveUserPreferencesFn,
  checkSaveConflictFn,
  forceSaveGameFn,
} from '@/server/functions/minesweeper'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const BASE_CELL_SIZE = 32
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const SECTOR_VIEW_THRESHOLD = 0.5 // Switch to sector view at 50% zoom or less
const EXPORT_SECTOR_SIZE = 100 // Number of sectors to export (100x100 sectors from center)
const EXPORT_PIXEL_SCALE = 10 // Scale factor for each sector (10x10 pixels per sector)
const EXPORT_CHUNK_SIZE = 50 // Process 50 rows at a time to prevent freezing
const AUTO_SAVE_DELAY = 1000 // 1 second of inactivity before auto-save
const PREFERENCES_SAVE_DELAY = 1000 // 1 second delay for preferences
const DRAG_THRESHOLD = 5 // Pixels moved before considering it a drag
const ANIMATION_DURATION = 300 // Duration for zoom/pan animations in ms

// Detect macOS for trackpad-friendly zoom behavior
const isMacOS =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)

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
  const [isSavingForNavigation, setIsSavingForNavigation] = useState(false)

  // Save conflict state
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<{
    serverSave: {
      health: number | null
      tilesOpened: number
      savedAt: string
    }
    localSave: {
      health: number
      tilesOpened: number
    }
  } | null>(null)
  const lastKnownSaveTimeRef = useRef<string | null>(
    initialSave?.updatedAt ?? null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const preferencesSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMountRef = useRef(true)
  const isMobile = useIsMobile()

  // Track drag state for click prevention
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const dragButtonRef = useRef<number | null>(null)
  const isPinchingRef = useRef<boolean>(false)
  const animationFrameRef = useRef<number | null>(null)

  const saveGame = useServerFn(saveGameFn)
  const deleteGameSave = useServerFn(deleteGameSaveFn)
  const savePreferences = useServerFn(saveUserPreferencesFn)
  const checkSaveConflict = useServerFn(checkSaveConflictFn)
  const forceSaveGame = useServerFn(forceSaveGameFn)

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

  // Track previous lives to detect when player dies
  const prevLivesRef = useRef<number>(maxLives)

  // Trigger flash effect for long-press feedback
  const triggerFlash = useCallback(() => {
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 400)

    // Trigger haptic vibration on mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50) // Short 50ms vibration
    }
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

  // Perform save operation - returns true if successful
  const performSave = useCallback(async (): Promise<boolean> => {
    if (isSaving) return false

    setIsSaving(true)
    setSaveError(null)

    try {
      // Check for conflicts first
      const conflictResult = await checkSaveConflict({
        data: { lastKnownSaveTime: lastKnownSaveTimeRef.current },
      })

      if (conflictResult.hasConflict && conflictResult.serverSave) {
        // There's a newer save on the server - show conflict dialog
        setConflictInfo({
          serverSave: conflictResult.serverSave,
          localSave: {
            health: lives,
            tilesOpened: revealedCount,
          },
        })
        setShowConflictDialog(true)
        setIsSaving(false)
        return false // Don't save yet, wait for user decision
      }

      const state = getSerializableState()
      const result = await saveGame({
        data: {
          ...state,
          viewportOffsetX: offset.x,
          viewportOffsetY: offset.y,
          zoomLevel: zoom,
        },
      })

      // Update last known save time
      if (result.updatedAt) {
        lastKnownSaveTimeRef.current = result.updatedAt
      }

      markAsSaved()
      return true
    } catch (error) {
      console.error('Failed to save game:', error)
      setSaveError('Failed to save')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [
    getSerializableState,
    saveGame,
    markAsSaved,
    offset,
    zoom,
    isSaving,
    checkSaveConflict,
    lives,
    revealedCount,
  ])

  // Handle conflict resolution - use server save
  const handleUseServerSave = useCallback(async () => {
    setShowConflictDialog(false)
    setConflictInfo(null)

    // Reload the page to get the server save
    window.location.reload()
  }, [])

  // Handle conflict resolution - override with local save
  const handleOverrideServerSave = useCallback(async () => {
    setShowConflictDialog(false)
    setConflictInfo(null)
    setIsSaving(true)
    setSaveError(null)

    try {
      const state = getSerializableState()
      const result = await forceSaveGame({
        data: {
          ...state,
          viewportOffsetX: offset.x,
          viewportOffsetY: offset.y,
          zoomLevel: zoom,
          forceOverride: true,
        },
      })

      // Update last known save time
      if (result.updatedAt) {
        lastKnownSaveTimeRef.current = result.updatedAt
      }

      markAsSaved()
    } catch (error) {
      console.error('Failed to force save game:', error)
      setSaveError('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [getSerializableState, forceSaveGame, markAsSaved, offset, zoom])

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

  // Auto-save immediately when player runs out of lives
  useEffect(() => {
    // Check if lives just dropped to 0
    if (prevLivesRef.current > 0 && lives === 0) {
      // Clear any pending auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      // Trigger immediate save
      performSave()
    }
    // Update previous lives ref
    prevLivesRef.current = lives
  }, [lives, performSave])

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

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const cellSize = BASE_CELL_SIZE * zoom
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

  // Export board as PNG (100x100 sectors, scaled to 1000x1000 pixels, centered at 0,0)
  // Includes legend, branding, and statistics
  const handleExportPNG = useCallback(async () => {
    // Prevent multiple exports at once
    if (exportProgress !== null) return

    setExportProgress(0)

    const mapSize = EXPORT_SECTOR_SIZE * EXPORT_PIXEL_SCALE // 1000x1000 pixels for map
    const legendHeight = 220 // Height for gamified legend panel
    const canvasWidth = mapSize
    const canvasHeight = mapSize + legendHeight

    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setExportProgress(null)
      return
    }

    // Fill entire canvas with dark background
    ctx.fillStyle = '#1c1917' // stone-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Fill map area with untouched color (dark gray)
    ctx.fillStyle = '#44403c' // stone-700
    ctx.fillRect(0, 0, mapSize, mapSize)

    // Calculate sector range (centered at 0,0)
    const halfSize = Math.floor(EXPORT_SECTOR_SIZE / 2)
    const minSectorX = -halfSize
    const minSectorY = -halfSize

    // Color mapping for sector states
    const sectorColors: Record<SectorState, string> = {
      untouched: '#44403c', // stone-700
      'in-progress': '#b45309', // amber-700
      finished: '#15803d', // green-700
    }

    // Track statistics while rendering
    let finishedCount = 0
    let inProgressCount = 0
    const totalSectors = EXPORT_SECTOR_SIZE * EXPORT_SECTOR_SIZE

    // Process in chunks to prevent freezing
    const totalRows = EXPORT_SECTOR_SIZE
    let currentRow = 0

    const processChunk = (): Promise<void> => {
      return new Promise((resolve) => {
        const endRow = Math.min(currentRow + EXPORT_CHUNK_SIZE, totalRows)

        for (let py = currentRow; py < endRow; py++) {
          for (let px = 0; px < EXPORT_SECTOR_SIZE; px++) {
            const sectorX = minSectorX + px
            const sectorY = minSectorY + py
            const state = getSectorState(sectorX, sectorY)

            // Track statistics
            if (state === 'finished') {
              finishedCount++
            } else if (state === 'in-progress') {
              inProgressCount++
            }

            // Only draw if not untouched (untouched is already the background)
            if (state !== 'untouched') {
              ctx.fillStyle = sectorColors[state]
              // Draw scaled pixel (10x10 block for each sector)
              ctx.fillRect(
                px * EXPORT_PIXEL_SCALE,
                py * EXPORT_PIXEL_SCALE,
                EXPORT_PIXEL_SCALE,
                EXPORT_PIXEL_SCALE,
              )
            }
          }
        }

        currentRow = endRow
        setExportProgress(Math.round((currentRow / totalRows) * 95)) // Reserve 5% for legend

        // Yield to browser using requestAnimationFrame
        requestAnimationFrame(() => resolve())
      })
    }

    // Process all chunks
    while (currentRow < totalRows) {
      await processChunk()
    }

    // === GAMIFIED LEGEND PANEL ===
    const legendY = mapSize + 20
    const completionPercent = (finishedCount / totalSectors) * 100

    // Helper function to draw rounded rectangle
    const drawRoundedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
    ) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    // === LEFT SIDE: Branding & Progress ===

    // Title with emoji
    ctx.fillStyle = '#fafaf9' // stone-50
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('💣 Infinite Minesweeper', 24, legendY + 28)

    // Date/time subtitle
    const now = new Date()
    const dateTimeStr = now.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    ctx.fillStyle = '#78716c' // stone-500
    ctx.font = '13px system-ui, -apple-system, sans-serif'
    ctx.fillText(dateTimeStr, 24, legendY + 50)

    // Progress bar background
    const progressBarX = 24
    const progressBarY = legendY + 70
    const progressBarWidth = 320
    const progressBarHeight = 24
    const progressBarRadius = 12

    ctx.fillStyle = '#292524' // stone-800
    drawRoundedRect(
      progressBarX,
      progressBarY,
      progressBarWidth,
      progressBarHeight,
      progressBarRadius,
    )
    ctx.fill()

    // Progress bar fill (gradient)
    const progressFillWidth = Math.max(
      progressBarRadius * 2,
      (completionPercent / 100) * progressBarWidth,
    )
    const gradient = ctx.createLinearGradient(
      progressBarX,
      0,
      progressBarX + progressFillWidth,
      0,
    )
    gradient.addColorStop(0, '#22c55e') // green-500
    gradient.addColorStop(1, '#16a34a') // green-600
    ctx.fillStyle = gradient
    drawRoundedRect(
      progressBarX,
      progressBarY,
      progressFillWidth,
      progressBarHeight,
      progressBarRadius,
    )
    ctx.fill()

    // Progress percentage text on bar
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${completionPercent.toFixed(2)}%`,
      progressBarX + progressBarWidth / 2,
      progressBarY + 16,
    )

    // Color legend with icons
    const legendItemY = legendY + 120
    const legendItems = [
      { color: '#44403c', label: 'Unexplored', icon: '🔲' },
      { color: '#b45309', label: 'In Progress', icon: '🔶' },
      { color: '#15803d', label: 'Completed', icon: '✅' },
    ]

    ctx.font = '13px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    let currentX = 24

    legendItems.forEach((item) => {
      // Draw icon
      ctx.fillText(item.icon, currentX, legendItemY)

      // Draw color box
      ctx.fillStyle = item.color
      ctx.fillRect(currentX + 22, legendItemY - 12, 14, 14)

      // Draw label
      ctx.fillStyle = '#a8a29e' // stone-400
      ctx.fillText(item.label, currentX + 42, legendItemY)

      currentX += ctx.measureText(item.label).width + 75
    })

    // === RIGHT SIDE: Gamified Stats ===
    const statsX = canvasWidth - 24

    // XP-style tiles counter with badge
    const tilesBoxWidth = 200
    const tilesBoxHeight = 70
    const tilesBoxX = statsX - tilesBoxWidth
    const tilesBoxY = legendY + 10

    // Badge background
    ctx.fillStyle = '#292524' // stone-800
    drawRoundedRect(tilesBoxX, tilesBoxY, tilesBoxWidth, tilesBoxHeight, 12)
    ctx.fill()

    // Badge accent line
    ctx.fillStyle = '#f59e0b' // amber-500
    drawRoundedRect(tilesBoxX, tilesBoxY, 6, tilesBoxHeight, 3)
    ctx.fill()

    // XP icon and label
    ctx.fillStyle = '#fbbf24' // amber-400
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('⚡ TILES CLEARED', tilesBoxX + 16, tilesBoxY + 22)

    // Big number
    ctx.fillStyle = '#fafaf9' // stone-50
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
    ctx.fillText(revealedCount.toLocaleString(), tilesBoxX + 16, tilesBoxY + 54)

    // Sectors completed badge
    const sectorsBoxY = tilesBoxY + tilesBoxHeight + 12
    const sectorsBoxHeight = 50

    ctx.fillStyle = '#292524' // stone-800
    drawRoundedRect(tilesBoxX, sectorsBoxY, tilesBoxWidth, sectorsBoxHeight, 12)
    ctx.fill()

    // Badge accent line (green for completed)
    ctx.fillStyle = '#22c55e' // green-500
    drawRoundedRect(tilesBoxX, sectorsBoxY, 6, sectorsBoxHeight, 3)
    ctx.fill()

    // Sectors icon and count
    ctx.fillStyle = '#4ade80' // green-400
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('🏆 SECTORS', tilesBoxX + 16, sectorsBoxY + 20)

    ctx.fillStyle = '#fafaf9' // stone-50
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
    ctx.fillText(
      `${finishedCount.toLocaleString()} completed`,
      tilesBoxX + 16,
      sectorsBoxY + 40,
    )

    // In-progress mini badge
    const inProgressBoxX = tilesBoxX - 120
    const inProgressBoxY = sectorsBoxY
    const inProgressBoxWidth = 110
    const inProgressBoxHeight = 50

    ctx.fillStyle = '#292524' // stone-800
    drawRoundedRect(
      inProgressBoxX,
      inProgressBoxY,
      inProgressBoxWidth,
      inProgressBoxHeight,
      12,
    )
    ctx.fill()

    // Amber accent
    ctx.fillStyle = '#f59e0b' // amber-500
    drawRoundedRect(inProgressBoxX, inProgressBoxY, 6, inProgressBoxHeight, 3)
    ctx.fill()

    ctx.fillStyle = '#fbbf24' // amber-400
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.fillText('🔥 ACTIVE', inProgressBoxX + 14, inProgressBoxY + 20)

    ctx.fillStyle = '#fafaf9' // stone-50
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif'
    ctx.fillText(
      inProgressCount.toLocaleString(),
      inProgressBoxX + 14,
      inProgressBoxY + 40,
    )

    // Map coordinates footer
    ctx.fillStyle = '#57534e' // stone-600
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(
      `Map region: (${minSectorX}, ${minSectorY}) to (${minSectorX + EXPORT_SECTOR_SIZE - 1}, ${minSectorY + EXPORT_SECTOR_SIZE - 1})`,
      24,
      legendY + 195,
    )

    setExportProgress(100)

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
  }, [getSectorState, exportProgress, revealedCount])

  // Check if at minimum zoom (10%)
  const isAtMinZoom = zoom <= 0.1

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

  // Handle sector click when zoomed out - zoom to 120% centered on clicked sector
  const handleSectorClick = useCallback(
    (sectorX: number, sectorY: number) => {
      // Don't allow click if we just dragged
      if (hasDraggedRef.current) return

      // Cancel any ongoing animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      const targetZoom = 1.2 // 120%
      const newCellSize = BASE_CELL_SIZE * targetZoom

      // Calculate the center of the clicked sector in world coordinates
      const sectorCenterX = (sectorX + 0.5) * SECTOR_SIZE * newCellSize
      const sectorCenterY = (sectorY + 0.5) * SECTOR_SIZE * newCellSize

      // Calculate offset to center the sector on screen
      const targetOffsetX = containerSize.width / 2 - sectorCenterX
      const targetOffsetY = containerSize.height / 2 - sectorCenterY

      // Store starting values
      const startZoom = zoom
      const startOffsetX = offset.x
      const startOffsetY = offset.y
      const startTime = performance.now()

      // Easing function: easeOutCubic for smooth deceleration
      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3)
      }

      // Animation loop
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1)
        const easedProgress = easeOutCubic(progress)

        // Interpolate values
        const currentZoom = startZoom + (targetZoom - startZoom) * easedProgress
        const currentOffsetX =
          startOffsetX + (targetOffsetX - startOffsetX) * easedProgress
        const currentOffsetY =
          startOffsetY + (targetOffsetY - startOffsetY) * easedProgress

        setZoom(currentZoom)
        setOffset({ x: currentOffsetX, y: currentOffsetY })

        // Continue animation if not complete
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          animationFrameRef.current = null
        }
      }

      // Start animation
      animationFrameRef.current = requestAnimationFrame(animate)
    },
    [containerSize, zoom, offset],
  )

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      let newZoom: number

      if (isMacOS) {
        // macOS trackpad: use smooth proportional zoom
        // Trackpads send small deltaY values frequently, so we scale proportionally
        const zoomSensitivity = 0.002 // Adjust sensitivity for trackpad
        const zoomDelta = -e.deltaY * zoomSensitivity
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 + zoomDelta)))
      } else {
        // Windows/Linux: use fixed step zoom
        if (e.deltaY > 0) {
          // Zooming out
          newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP)
        } else {
          // Zooming in
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
    centerX?: number
    centerY?: number
    initialZoom?: number
  } | null>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        isPinchingRef.current = false
        touchStartRef.current = {
          x: e.touches[0].clientX - offset.x,
          y: e.touches[0].clientY - offset.y,
        }
      } else if (e.touches.length === 2) {
        // Mark as pinching immediately when second finger touches
        isPinchingRef.current = true

        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Calculate pinch center in screen coordinates
        const rect = containerRef.current?.getBoundingClientRect()
        const centerX =
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - (rect?.left ?? 0)
        const centerY =
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - (rect?.top ?? 0)

        touchStartRef.current = {
          x: offset.x,
          y: offset.y,
          distance,
          centerX,
          centerY,
          initialZoom: zoom,
        }
      }
    },
    [offset, zoom],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return

      if (
        e.touches.length === 1 &&
        !touchStartRef.current.distance &&
        !isPinchingRef.current
      ) {
        // Single finger pan (only if not pinching)
        setOffset({
          x: e.touches[0].clientX - touchStartRef.current.x,
          y: e.touches[0].clientY - touchStartRef.current.y,
        })
      } else if (e.touches.length === 2 && touchStartRef.current.distance) {
        // Pinch zoom
        isPinchingRef.current = true

        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Calculate scale with reduced sensitivity for smoother zoom
        const rawScale = distance / touchStartRef.current.distance

        // Apply full scale change (1.0 = 100% of the raw scale change)
        const dampenedScale = 1 + (rawScale - 1) * 1.0

        const initialZoom = touchStartRef.current.initialZoom ?? zoom
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, initialZoom * dampenedScale),
        )

        // Zoom towards pinch center
        const centerX = touchStartRef.current.centerX ?? 0
        const centerY = touchStartRef.current.centerY ?? 0
        const initialOffsetX = touchStartRef.current.x
        const initialOffsetY = touchStartRef.current.y

        // Calculate new offset to keep pinch center stationary
        const zoomRatio = newZoom / initialZoom
        const newOffsetX = centerX - (centerX - initialOffsetX) * zoomRatio
        const newOffsetY = centerY - (centerY - initialOffsetY) * zoomRatio

        setZoom(newZoom)
        setOffset({ x: newOffsetX, y: newOffsetY })
      }
    },
    [zoom],
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // If we still have touches, don't reset pinching state yet
      if (e.touches.length > 0) {
        // Transitioning from 2 fingers to 1 finger
        if (e.touches.length === 1) {
          // Reset touch start for single finger pan, but keep pinching flag
          // to prevent accidental cell interactions
          touchStartRef.current = {
            x: e.touches[0].clientX - offset.x,
            y: e.touches[0].clientY - offset.y,
          }
        }
        return
      }

      // All fingers lifted - reset after a short delay to prevent tap from firing
      setTimeout(() => {
        isPinchingRef.current = false
      }, 100)
      touchStartRef.current = null
    },
    [offset],
  )

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

  // Sign out handler - save game first
  const handleSignOut = useCallback(async () => {
    if (isSavingForNavigation) return

    setIsSavingForNavigation(true)
    try {
      // Only save if there are unsaved changes
      if (isDirty) {
        const saved = await performSave()
        if (!saved) {
          // Save failed, stay on page
          setIsSavingForNavigation(false)
          return
        }
      }
      navigate({ to: '/sign-out' })
    } catch (error) {
      console.error('Failed to save before sign out:', error)
      setIsSavingForNavigation(false)
    }
  }, [navigate, performSave, isDirty, isSavingForNavigation])

  // Leaderboard handler - save game first
  const handleLeaderboard = useCallback(async () => {
    if (isSavingForNavigation) return

    setIsSavingForNavigation(true)
    try {
      // Only save if there are unsaved changes
      if (isDirty) {
        const saved = await performSave()
        if (!saved) {
          // Save failed, stay on page
          setIsSavingForNavigation(false)
          return
        }
      }
      navigate({ to: '/leaderboard' })
    } catch (error) {
      console.error('Failed to save before leaderboard:', error)
      setIsSavingForNavigation(false)
    }
  }, [navigate, performSave, isDirty, isSavingForNavigation])

  const isWaiting = gameState === 'waiting'

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
            animation: 'flash-fade 400ms ease-out forwards',
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
        saveStatus={{
          isDirty,
          isSaving,
          lastSaveTime,
          error: saveError,
          onForceSave: performSave,
        }}
        isSavingForNavigation={isSavingForNavigation}
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

            {/* Save status indicator */}
            <div className="mt-6 pt-4 border-t border-stone-700">
              <button
                onClick={performSave}
                disabled={isSaving || (!isDirty && !saveError)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  transition-all duration-200
                  ${
                    saveError
                      ? 'bg-red-900/50 hover:bg-red-900/70 cursor-pointer'
                      : isSaving
                        ? 'bg-stone-800 cursor-wait'
                        : isDirty
                          ? 'bg-stone-800 hover:bg-stone-700 cursor-pointer'
                          : 'bg-stone-800/50 cursor-default'
                  }
                `}
                title={
                  saveError
                    ? 'Click to retry saving'
                    : isDirty
                      ? 'Click to save now'
                      : 'Game saved'
                }
              >
                {saveError ? (
                  <>
                    <AlertCircle size={16} className="text-red-400" />
                    <span className="text-red-400 text-sm font-medium">
                      Save failed - tap to retry
                    </span>
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2
                      size={16}
                      className="text-amber-400 animate-spin"
                    />
                    <span className="text-amber-400 text-sm font-medium">
                      Saving...
                    </span>
                  </>
                ) : isDirty ? (
                  <>
                    <CloudOff size={16} className="text-stone-400" />
                    <span className="text-stone-400 text-sm font-medium">
                      Unsaved changes - tap to save
                    </span>
                  </>
                ) : (
                  <>
                    <Check size={16} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">
                      Progress saved
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
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
        {containerSize.width > 0 && containerSize.height > 0 && (
          <CanvasRenderer
            width={containerSize.width}
            height={containerSize.height}
            cellSize={cellSize}
            offset={offset}
            isZoomedOut={isZoomedOut}
            zoom={zoom}
            getCellState={getCellState}
            hasMine={hasMine}
            countAdjacentMines={countAdjacentMines}
            isSectorComplete={isSectorComplete}
            getSectorState={getSectorState}
            onReveal={revealCell}
            onFlag={toggleFlag}
            onSectorClick={handleSectorClick}
            isMobile={isMobile}
            mobileMode={mobileMode}
            gameState={gameState}
            shouldAllowClick={shouldAllowClick}
            onLongPressAction={triggerFlash}
            isPinchingRef={isPinchingRef}
          />
        )}
      </div>

      {/* Save Conflict Dialog */}
      <AlertDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
      >
        <AlertDialogContent className="bg-stone-900 border-stone-700 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-stone-100 flex items-center gap-2">
              <CloudOff className="text-amber-500" size={20} />
              Save Conflict Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-400">
              A newer save was found on the server. This can happen when playing
              on multiple devices. Choose which save to keep:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {conflictInfo && (
            <div className="grid grid-cols-2 gap-4 my-4">
              {/* Server Save */}
              <div className="bg-stone-800 rounded-lg p-4 border border-stone-700">
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="text-blue-400" size={16} />
                  <span className="text-stone-300 font-medium text-sm">
                    Server Save
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Heart
                          key={i}
                          size={14}
                          className={
                            i < (conflictInfo.serverSave.health ?? 0)
                              ? 'text-red-500 fill-red-500'
                              : 'text-stone-600'
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-stone-200 text-sm">
                    {conflictInfo.serverSave.tilesOpened.toLocaleString()} tiles
                  </p>
                  <p className="text-stone-500 text-xs">
                    {new Date(conflictInfo.serverSave.savedAt).toLocaleString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                  </p>
                </div>
              </div>

              {/* Local Save */}
              <div className="bg-stone-800 rounded-lg p-4 border border-amber-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-400 text-sm">📱</span>
                  <span className="text-stone-300 font-medium text-sm">
                    This Device
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Heart
                          key={i}
                          size={14}
                          className={
                            i < conflictInfo.localSave.health
                              ? 'text-red-500 fill-red-500'
                              : 'text-stone-600'
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-stone-200 text-sm">
                    {conflictInfo.localSave.tilesOpened.toLocaleString()} tiles
                  </p>
                  <p className="text-stone-500 text-xs">Current session</p>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={handleUseServerSave}
              className="bg-stone-800 border-stone-600 text-stone-200 hover:bg-stone-700 hover:text-stone-100"
            >
              Use Server Save
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideServerSave}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Keep This Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
