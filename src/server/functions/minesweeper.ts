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
        })
        return {
          success: true,
          saveId: updated.$id,
          updatedAt: updated.$updatedAt,
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
        })
        return {
          success: true,
          saveId: created.$id,
          updatedAt: created.$updatedAt,
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

      return { success: true }
    } catch (error) {
      console.error('Error deleting game save:', error)
      throw new Error('Failed to delete game save')
    }
  },
)
