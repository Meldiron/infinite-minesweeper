import { ImaginePlaceholder } from '@/components/imagine-placeholder'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/')({
  component: Index,
})

function Index() {
  return (
    <div className="min-h-screen flex flex-col p-8">
      <ImaginePlaceholder />
    </div>
  )
}
