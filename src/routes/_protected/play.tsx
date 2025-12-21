import { createFileRoute } from '@tanstack/react-router'
import { MinesweeperGame } from '@/components/minesweeper/MinesweeperGame'
import { getGameSaveFn } from '@/server/functions/minesweeper'

export const Route = createFileRoute('/_protected/play')({
  component: PlayPage,
  loader: async () => {
    const { save } = await getGameSaveFn()
    return { initialSave: save }
  },
})

function PlayPage() {
  const { initialSave } = Route.useLoaderData()

  return <MinesweeperGame initialSave={initialSave} />
}
