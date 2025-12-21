import { createFileRoute } from '@tanstack/react-router'
import { MinesweeperGame } from '@/components/minesweeper/MinesweeperGame'
import {
  getGameSaveFn,
  getUserPreferencesFn,
} from '@/server/functions/minesweeper'

export const Route = createFileRoute('/_protected/play')({
  component: PlayPage,
  loader: async () => {
    const [{ save }, { preferences }] = await Promise.all([
      getGameSaveFn(),
      getUserPreferencesFn(),
    ])
    return { initialSave: save, initialPreferences: preferences }
  },
})

function PlayPage() {
  const { initialSave, initialPreferences } = Route.useLoaderData()

  return (
    <MinesweeperGame
      initialSave={initialSave}
      initialPreferences={initialPreferences}
    />
  )
}
