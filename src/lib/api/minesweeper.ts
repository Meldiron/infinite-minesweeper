import { DATABASE_ID, TABLES, tablesDB } from '@/lib/appwrite'
import { requireUserId } from './auth'
import type { MinesweeperSave, UserPreferences } from './types'

// The save and preferences rows are created by the game function and keyed by user ID.
// Players can read and update only their own rows.

type SaveGameInput = {
  cellStates: string
  removedMines: string | null
  completedSectors: string | null
  isFirstClick: boolean
  gameOver: boolean
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
  seed: number
  health: number | null
  healthRegenTimestamp: string | null
}

type PreferencesInput = {
  instructionsOpen: boolean
  interactionMode: string
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
}

function countRevealedCells(cellStatesJson: string): number {
  try {
    const cells = JSON.parse(cellStatesJson) as Record<
      string,
      { revealed?: boolean }
    >
    return Object.values(cells).filter((c) => c?.revealed === true).length
  } catch {
    return 0
  }
}

async function getOwnRow<T extends MinesweeperSave | UserPreferences>(
  tableId: string,
): Promise<T | null> {
  const userId = await requireUserId()
  try {
    return await tablesDB.getRow<T>({
      databaseId: DATABASE_ID,
      tableId,
      rowId: userId,
    })
  } catch {
    return null
  }
}

export async function getUserPreferencesFn() {
  const prefs = await getOwnRow<UserPreferences>(TABLES.preferences)
  if (!prefs) return { preferences: null }
  return {
    preferences: {
      id: prefs.$id,
      instructionsOpen: prefs.instructionsOpen,
      interactionMode: prefs.interactionMode,
      viewportOffsetX: prefs.viewportOffsetX,
      viewportOffsetY: prefs.viewportOffsetY,
      zoomLevel: prefs.zoomLevel,
    },
  }
}

export async function saveUserPreferencesFn({
  data,
}: {
  data: PreferencesInput
}) {
  const userId = await requireUserId()
  const updated = await tablesDB.updateRow<UserPreferences>({
    databaseId: DATABASE_ID,
    tableId: TABLES.preferences,
    rowId: userId,
    data,
  })
  return { success: true, preferencesId: updated.$id }
}

export async function getGameSaveFn() {
  const save = await getOwnRow<MinesweeperSave>(TABLES.saves)
  if (!save) return { save: null }
  return {
    save: {
      id: save.$id,
      cellStates: save.cellStates,
      removedMines: save.removedMines,
      completedSectors: save.completedSectors,
      isFirstClick: save.isFirstClick,
      gameOver: save.gameOver,
      viewportOffsetX: save.viewportOffsetX,
      viewportOffsetY: save.viewportOffsetY,
      zoomLevel: save.zoomLevel,
      seed: save.seed,
      health: save.health,
      healthRegenTimestamp: save.healthRegenTimestamp,
      updatedAt: save.$updatedAt,
    },
  }
}

// The leaderboard count is recomputed by the game function from this row.
export async function saveGameFn({ data }: { data: SaveGameInput }) {
  const userId = await requireUserId()
  const updated = await tablesDB.updateRow<MinesweeperSave>({
    databaseId: DATABASE_ID,
    tableId: TABLES.saves,
    rowId: userId,
    data,
  })
  return {
    success: true,
    saveId: updated.$id,
    updatedAt: updated.$updatedAt,
    tilesOpened: countRevealedCells(data.cellStates),
  }
}

export const forceSaveGameFn = ({
  data,
}: {
  data: SaveGameInput & { forceOverride?: boolean }
}) => {
  const { forceOverride: _ignored, ...save } = data
  return saveGameFn({ data: save })
}

// Players cannot create or delete rows, so a new game empties the save instead.
export async function deleteGameSaveFn() {
  const userId = await requireUserId()
  await tablesDB.updateRow<MinesweeperSave>({
    databaseId: DATABASE_ID,
    tableId: TABLES.saves,
    rowId: userId,
    data: {
      cellStates: '{}',
      removedMines: null,
      completedSectors: null,
      isFirstClick: true,
      gameOver: false,
      viewportOffsetX: null,
      viewportOffsetY: null,
      zoomLevel: null,
      seed: null,
      health: null,
      healthRegenTimestamp: null,
    },
  })
  return { success: true }
}

// Multi-device sync: is the stored save newer than the one this tab loaded?
export async function checkSaveConflictFn({
  data,
}: {
  data: { lastKnownSaveTime: string | null }
}) {
  const save = await getOwnRow<MinesweeperSave>(TABLES.saves)
  if (!save || !data.lastKnownSaveTime) {
    return { hasConflict: false, serverSave: null }
  }
  if (
    new Date(save.$updatedAt).getTime() >
    new Date(data.lastKnownSaveTime).getTime()
  ) {
    return {
      hasConflict: true,
      serverSave: {
        health: save.health,
        tilesOpened: countRevealedCells(save.cellStates),
        savedAt: save.$updatedAt,
      },
    }
  }
  return { hasConflict: false, serverSave: null }
}
