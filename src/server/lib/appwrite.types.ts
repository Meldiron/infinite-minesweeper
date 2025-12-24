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
  healthRegenTimestamp: string | null
  health: number | null
}

export type UserPreferences = Models.Row & {
  createdBy: string
  instructionsOpen: boolean
  interactionMode: string
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
}

export type UserOnboarding = Models.Row & {
  createdBy: string
  nickname: string
  onboardingCompleted: boolean
}

export type UserStats = Models.Row & {
  createdBy: string
  nickname: string
  tilesOpened: number
}
