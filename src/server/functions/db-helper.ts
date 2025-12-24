/**
 * Database helper for Appwrite collections
 * This provides typed access to the database collections defined in appwrite.json
 */

import {
  Client,
  Databases,
  Query,
  Models,
  Permission,
  Role,
} from 'node-appwrite'

// Get environment variables
const getAppwriteConfig = () => {
  const endpoint = process.env.APPWRITE_ENDPOINT
  if (!endpoint) throw new Error('APPWRITE_ENDPOINT is not set')

  const projectId = process.env.APPWRITE_PROJECT_ID
  if (!projectId) throw new Error('APPWRITE_PROJECT_ID is not set')

  const apiKey = process.env.APPWRITE_API_KEY
  if (!apiKey) throw new Error('APPWRITE_API_KEY is not set')

  const databaseId = process.env.APPWRITE_DB_ID || 'imagine-project-db'

  return { endpoint, projectId, apiKey, databaseId }
}

// Collection IDs from appwrite.json
const COLLECTIONS = {
  minesweeperSaves: 'minesweeper_saves',
  userPreferences: 'user_preferences',
  userOnboarding: 'user_onboarding',
  userStats: 'user_stats',
} as const

// Type definitions based on appwrite.json schema
export type MinesweeperSave = {
  createdBy: string
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

export type UserPreferences = {
  createdBy: string
  instructionsOpen: boolean
  interactionMode: string
  viewportOffsetX: number | null
  viewportOffsetY: number | null
  zoomLevel: number | null
}

export type UserOnboarding = {
  createdBy: string
  nickname: string
  onboardingCompleted: boolean
}

export type UserStats = {
  createdBy: string
  nickname: string
  tilesOpened: number
}

// Document types with Appwrite metadata
export type MinesweeperSaveDoc = MinesweeperSave & Models.Document
export type UserPreferencesDoc = UserPreferences & Models.Document
export type UserOnboardingDoc = UserOnboarding & Models.Document
export type UserStatsDoc = UserStats & Models.Document

// Create admin database client
function createDatabaseClient() {
  const { endpoint, projectId, apiKey } = getAppwriteConfig()
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey)

  return new Databases(client)
}

// Get database ID
function getDatabaseId() {
  return getAppwriteConfig().databaseId
}

// Generic collection helper
function createCollectionHelper<T extends Record<string, unknown>>(
  collectionId: string,
) {
  return {
    async list(
      queries: string[] = [],
    ): Promise<{ rows: (T & Models.Document)[]; total: number }> {
      const databases = createDatabaseClient()
      const result = await databases.listDocuments(
        getDatabaseId(),
        collectionId,
        queries,
      )
      return {
        rows: result.documents as unknown as (T & Models.Document)[],
        total: result.total,
      }
    },

    async get(documentId: string): Promise<T & Models.Document> {
      const databases = createDatabaseClient()
      return (await databases.getDocument(
        getDatabaseId(),
        collectionId,
        documentId,
      )) as T & Models.Document
    },

    async create(
      data: Omit<T, keyof Models.Document>,
      options?: { permissions?: string[] },
    ): Promise<T & Models.Document> {
      const databases = createDatabaseClient()
      return (await databases.createDocument(
        getDatabaseId(),
        collectionId,
        'unique()',
        data,
        options?.permissions,
      )) as T & Models.Document
    },

    async update(
      documentId: string,
      data: Partial<Omit<T, keyof Models.Document>>,
      options?: { permissions?: string[] },
    ): Promise<T & Models.Document> {
      const databases = createDatabaseClient()
      return (await databases.updateDocument(
        getDatabaseId(),
        collectionId,
        documentId,
        data,
        options?.permissions,
      )) as T & Models.Document
    },

    async delete(documentId: string): Promise<void> {
      const databases = createDatabaseClient()
      await databases.deleteDocument(getDatabaseId(), collectionId, documentId)
    },
  }
}

// Export typed collection helpers
export const db = {
  minesweeperSaves: createCollectionHelper<MinesweeperSave>(
    COLLECTIONS.minesweeperSaves,
  ),
  userPreferences: createCollectionHelper<UserPreferences>(
    COLLECTIONS.userPreferences,
  ),
  userOnboarding: createCollectionHelper<UserOnboarding>(
    COLLECTIONS.userOnboarding,
  ),
  userStats: createCollectionHelper<UserStats>(COLLECTIONS.userStats),
}

// Re-export Query and Permission for convenience
export { Query, Permission, Role }
