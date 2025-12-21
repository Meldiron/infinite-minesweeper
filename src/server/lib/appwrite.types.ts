import { type Models } from 'node-appwrite'

export type MinesweeperSaves = Models.Row & {
  createdBy: string
  cellStates: string
  removedMines: string | null
  completedSectors: string | null
  isFirstClick: boolean
  gameOver: boolean
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
  seed: number | null
}
