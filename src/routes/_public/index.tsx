import { MinesweeperGame } from '@/components/minesweeper'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/')({
  component: Index,
})

function Index() {
  return <MinesweeperGame />
}
