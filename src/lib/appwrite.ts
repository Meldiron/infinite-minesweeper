import { Account, Client, Functions, TablesDB } from 'appwrite'

// Public configuration, baked in at build time. All access control lives in
// Appwrite row permissions and the `game` function (functions/game).
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
if (!endpoint || !projectId) {
  throw new Error(
    'VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID must be set (see .env.example)',
  )
}

export const client = new Client().setEndpoint(endpoint).setProject(projectId)
export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const functions = new Functions(client)

export const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DB_ID || 'imagine-project-db'
export const GAME_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_GAME_FUNCTION_ID || 'game'

export const TABLES = {
  saves: 'minesweeper_saves',
  preferences: 'user_preferences',
  onboarding: 'user_onboarding',
  stats: 'user_stats',
} as const
