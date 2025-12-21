import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Grid3X3, Infinity, Heart, Save, Zap, Trophy } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-amber-600/20 p-4 rounded-2xl">
                <Grid3X3 size={48} className="text-amber-500" />
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold text-stone-100 mb-6">
              Infinite <span className="text-amber-500">Minesweeper</span>
            </h1>

            <p className="text-xl text-stone-400 max-w-2xl mx-auto mb-10">
              The classic puzzle game, reimagined without boundaries. Explore an
              endless grid, complete sectors, and track your progress forever.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/sign-up">
                <Button
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-6 text-lg"
                >
                  Start Playing Free
                </Button>
              </Link>
              <Link to="/sign-in">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white hover:bg-stone-100 text-stone-900 border-white px-8 py-6 text-lg"
                >
                  Sign In
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent hover:bg-stone-700 text-stone-100 border-stone-600 px-8 py-6 text-lg"
                >
                  <Trophy size={20} className="mr-2" />
                  Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-stone-100 text-center mb-12">
          Why You'll Love It
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Infinity className="text-amber-500" size={32} />}
            title="Infinite Grid"
            description="No boundaries. Explore in any direction forever. The grid generates procedurally as you play."
          />
          <FeatureCard
            icon={<Grid3X3 className="text-green-500" size={32} />}
            title="Sector System"
            description="Complete 8×8 sectors to mark your territory. Track your progress across the infinite expanse."
          />
          <FeatureCard
            icon={<Heart className="text-red-500" size={32} />}
            title="Lives System"
            description="5 lives that regenerate over time. Hit a mine? No problem—just wait and try again."
          />
          <FeatureCard
            icon={<Save className="text-blue-500" size={32} />}
            title="Auto-Save"
            description="Your progress saves automatically. Pick up right where you left off, anytime."
          />
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-stone-800/50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-stone-100 text-center mb-12">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Create Account"
              description="Sign up in seconds. Your game state is tied to your account."
            />
            <StepCard
              number={2}
              title="Start Exploring"
              description="Click to reveal cells, right-click to flag mines. Zoom out to see the big picture."
            />
            <StepCard
              number={3}
              title="Complete Sectors"
              description="Clear all safe cells in an 8×8 sector to mark it complete. Watch your map grow!"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-2xl p-10 border border-amber-800/30">
          <Zap size={40} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-stone-100 mb-4">
            Ready to Begin?
          </h2>
          <p className="text-stone-400 mb-8">
            Join thousands of players exploring the infinite grid.
          </p>
          <Link to="/sign-up">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-10"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-stone-500 text-sm">
          <p>Infinite Minesweeper • Built with ❤️</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-stone-800/50 rounded-xl p-6 border border-stone-700/50">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-stone-100 mb-2">{title}</h3>
      <p className="text-stone-400 text-sm">{description}</p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-stone-100 mb-2">{title}</h3>
      <p className="text-stone-400">{description}</p>
    </div>
  )
}
