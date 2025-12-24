import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth'
import { db } from '@/server/lib/db'
import { Query } from 'node-appwrite'

// Schema for saving game state
const saveGameSchema = z.object({
  cellStates: z.string(),
  removedMines: z.string().nullable(),
  completedSectors: z.string().nullable(),
  isFirstClick: z.boolean(),
  gameOver: z.boolean(),
  viewportOffsetX: z.number().nullable(),
  viewportOffsetY: z.number().nullable(),
  zoomLevel: z.number().nullable(),
  seed: z.number(),
  health: z.number().nullable(),
  healthRegenTimestamp: z.string().nullable(),
})

// Schema for saving user preferences
const savePreferencesSchema = z.object({
  instructionsOpen: z.boolean(),
  interactionMode: z.string(),
  viewportOffsetX: z.number().nullable(),
  viewportOffsetY: z.number().nullable(),
  zoomLevel: z.number().nullable(),
})

// Helper function to count revealed cells from cellStates JSON
function countRevealedCells(cellStatesJson: string): number {
  try {
    const cellStates = JSON.parse(cellStatesJson) as Record<
      string,
      { revealed: boolean; flagged: boolean; exploded?: boolean }
    >
    let count = 0
    for (const key in cellStates) {
      const state = cellStates[key]
      // Count cells that are revealed (including exploded mines, but not flagged-only cells)
      if (state && state.revealed === true) {
        count++
      }
    }
    return count
  } catch {
    return 0
  }
}

// Get the current user's preferences
export const getUserPreferencesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      const result = await db.userPreferences.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (result.rows.length === 0) {
        return { preferences: null }
      }

      const prefs = result.rows[0]
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
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      return { preferences: null }
    }
  },
)

// Save or update the current user's preferences
export const saveUserPreferencesFn = createServerFn({ method: 'POST' })
  .inputValidator(savePreferencesSchema)
  .handler(async ({ data }) => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      // Check if user already has preferences
      const existing = await db.userPreferences.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (existing.rows.length > 0) {
        // Update existing preferences
        const updated = await db.userPreferences.update(existing.rows[0].$id, {
          instructionsOpen: data.instructionsOpen,
          interactionMode: data.interactionMode,
          viewportOffsetX: data.viewportOffsetX,
          viewportOffsetY: data.viewportOffsetY,
          zoomLevel: data.zoomLevel,
        })
        return {
          success: true,
          preferencesId: updated.$id,
        }
      } else {
        // Create new preferences
        const created = await db.userPreferences.create({
          createdBy: currentUser.$id,
          instructionsOpen: data.instructionsOpen,
          interactionMode: data.interactionMode,
          viewportOffsetX: data.viewportOffsetX,
          viewportOffsetY: data.viewportOffsetY,
          zoomLevel: data.zoomLevel,
        })
        return {
          success: true,
          preferencesId: created.$id,
        }
      }
    } catch (error) {
      console.error('Error saving user preferences:', error)
      throw new Error('Failed to save preferences')
    }
  })

// Get the current user's game save
export const getGameSaveFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      const result = await db.minesweeperSaves.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (result.rows.length === 0) {
        return { save: null }
      }

      const save = result.rows[0]
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
    } catch (error) {
      console.error('Error fetching game save:', error)
      return { save: null }
    }
  },
)

// Save or update the current user's game
export const saveGameFn = createServerFn({ method: 'POST' })
  .inputValidator(saveGameSchema)
  .handler(async ({ data }) => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      // Count revealed cells for leaderboard stats
      const revealedCount = countRevealedCells(data.cellStates)

      // Update user stats for leaderboard
      const existingStats = await db.userStats.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      const tilesOpened = revealedCount
      if (existingStats.rows.length > 0) {
        // Update tilesOpened count
        await db.userStats.update(existingStats.rows[0].$id, {
          tilesOpened: revealedCount,
        })
      }
      // Note: If stats don't exist, they'll be created during onboarding

      // Check if user already has a save
      const existing = await db.minesweeperSaves.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (existing.rows.length > 0) {
        // Update existing save
        const updated = await db.minesweeperSaves.update(existing.rows[0].$id, {
          cellStates: data.cellStates,
          removedMines: data.removedMines,
          completedSectors: data.completedSectors,
          isFirstClick: data.isFirstClick,
          gameOver: data.gameOver,
          viewportOffsetX: data.viewportOffsetX,
          viewportOffsetY: data.viewportOffsetY,
          zoomLevel: data.zoomLevel,
          seed: data.seed,
          health: data.health,
          healthRegenTimestamp: data.healthRegenTimestamp,
        })
        return {
          success: true,
          saveId: updated.$id,
          updatedAt: updated.$updatedAt,
          tilesOpened,
        }
      } else {
        // Create new save
        const created = await db.minesweeperSaves.create({
          createdBy: currentUser.$id,
          cellStates: data.cellStates,
          removedMines: data.removedMines,
          completedSectors: data.completedSectors,
          isFirstClick: data.isFirstClick,
          gameOver: data.gameOver,
          viewportOffsetX: data.viewportOffsetX,
          viewportOffsetY: data.viewportOffsetY,
          zoomLevel: data.zoomLevel,
          seed: data.seed,
          health: data.health,
          healthRegenTimestamp: data.healthRegenTimestamp,
        })
        return {
          success: true,
          saveId: created.$id,
          updatedAt: created.$updatedAt,
          tilesOpened,
        }
      }
    } catch (error) {
      console.error('Error saving game:', error)
      throw new Error('Failed to save game')
    }
  })

// Delete the current user's game save (for reset)
export const deleteGameSaveFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { currentUser } = await authMiddleware()
    if (!currentUser) {
      throw new Error('Unauthorized')
    }

    try {
      const existing = await db.minesweeperSaves.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (existing.rows.length > 0) {
        await db.minesweeperSaves.delete(existing.rows[0].$id)
      }

      // Reset tilesOpened count in user stats
      const existingStats = await db.userStats.list([
        Query.equal('createdBy', [currentUser.$id]),
        Query.limit(1),
      ])

      if (existingStats.rows.length > 0) {
        await db.userStats.update(existingStats.rows[0].$id, {
          tilesOpened: 0,
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting game save:', error)
      throw new Error('Failed to delete game save')
    }
  },
)
