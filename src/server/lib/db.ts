import {
  Client,
  TablesDB,
  ID,
  type Models,
  Permission,
  Role,
} from 'node-appwrite'
import type {
  MinesweeperSaves,
  UserPreferences,
  UserOnboarding,
} from './appwrite.types'

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

const tablesDB = new TablesDB(client)

export const db = {
  minesweeperSaves: {
    create: (
      data: Omit<MinesweeperSaves, keyof Models.Row>,
      options?: { rowId?: string; permissions?: string[] },
    ) =>
      tablesDB.createRow<MinesweeperSaves>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'minesweeper_saves',
        rowId: options?.rowId ?? ID.unique(),
        data,
        permissions: [
          Permission.write(Role.user(data.createdBy)),
          Permission.read(Role.user(data.createdBy)),
          Permission.update(Role.user(data.createdBy)),
          Permission.delete(Role.user(data.createdBy)),
        ],
      }),
    get: (id: string) =>
      tablesDB.getRow<MinesweeperSaves>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'minesweeper_saves',
        rowId: id,
      }),
    update: (
      id: string,
      data: Partial<Omit<MinesweeperSaves, keyof Models.Row>>,
      options?: { permissions?: string[] },
    ) =>
      tablesDB.updateRow<MinesweeperSaves>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'minesweeper_saves',
        rowId: id,
        data,
        ...(options?.permissions ? { permissions: options.permissions } : {}),
      }),
    delete: (id: string) =>
      tablesDB.deleteRow({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'minesweeper_saves',
        rowId: id,
      }),
    list: (queries?: string[]) =>
      tablesDB.listRows<MinesweeperSaves>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'minesweeper_saves',
        queries,
      }),
  },
  userPreferences: {
    create: (
      data: Omit<UserPreferences, keyof Models.Row>,
      options?: { rowId?: string; permissions?: string[] },
    ) =>
      tablesDB.createRow<UserPreferences>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_preferences',
        rowId: options?.rowId ?? ID.unique(),
        data,
        permissions: [
          Permission.write(Role.user(data.createdBy)),
          Permission.read(Role.user(data.createdBy)),
          Permission.update(Role.user(data.createdBy)),
          Permission.delete(Role.user(data.createdBy)),
        ],
      }),
    get: (id: string) =>
      tablesDB.getRow<UserPreferences>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_preferences',
        rowId: id,
      }),
    update: (
      id: string,
      data: Partial<Omit<UserPreferences, keyof Models.Row>>,
      options?: { permissions?: string[] },
    ) =>
      tablesDB.updateRow<UserPreferences>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_preferences',
        rowId: id,
        data,
        ...(options?.permissions ? { permissions: options.permissions } : {}),
      }),
    delete: (id: string) =>
      tablesDB.deleteRow({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_preferences',
        rowId: id,
      }),
    list: (queries?: string[]) =>
      tablesDB.listRows<UserPreferences>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_preferences',
        queries,
      }),
  },
  userOnboarding: {
    create: (
      data: Omit<UserOnboarding, keyof Models.Row>,
      options?: { rowId?: string; permissions?: string[] },
    ) =>
      tablesDB.createRow<UserOnboarding>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_onboarding',
        rowId: options?.rowId ?? ID.unique(),
        data,
        permissions: [
          Permission.write(Role.user(data.createdBy)),
          Permission.read(Role.user(data.createdBy)),
          Permission.update(Role.user(data.createdBy)),
          Permission.delete(Role.user(data.createdBy)),
        ],
      }),
    get: (id: string) =>
      tablesDB.getRow<UserOnboarding>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_onboarding',
        rowId: id,
      }),
    update: (
      id: string,
      data: Partial<Omit<UserOnboarding, keyof Models.Row>>,
      options?: { permissions?: string[] },
    ) =>
      tablesDB.updateRow<UserOnboarding>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_onboarding',
        rowId: id,
        data,
        ...(options?.permissions ? { permissions: options.permissions } : {}),
      }),
    delete: (id: string) =>
      tablesDB.deleteRow({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_onboarding',
        rowId: id,
      }),
    list: (queries?: string[]) =>
      tablesDB.listRows<UserOnboarding>({
        databaseId: process.env.APPWRITE_DB_ID!,
        tableId: 'user_onboarding',
        queries,
      }),
  },
}
