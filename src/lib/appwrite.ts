import { Account, Client, TablesDB } from 'appwrite'

// Public configuration, baked in at build time. Access control lives in Appwrite
// row permissions; the `game` function (functions/game) checks rows in the background.
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

export const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DB_ID || 'imagine-project-db'

export const TABLES = {
  saves: 'minesweeper_saves',
  preferences: 'user_preferences',
  onboarding: 'user_onboarding',
  stats: 'user_stats',
} as const
