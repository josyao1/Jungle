import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JUNGLE',
  description: 'IM Basketball Sportsbook',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="glass-card border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold tracking-wide">
                <span className="bg-gradient-to-r from-court-accent to-court-orange bg-clip-text text-transparent">
                  JUNGLE
                </span>
              </a>
              <div className="flex gap-6 text-sm font-medium">
                <a href="/set-lines" className="text-slate-400 hover:text-white transition-colors">Lines</a>
                <a href="/pick" className="text-slate-400 hover:text-white transition-colors">Pick</a>
                <a href="/results" className="text-slate-400 hover:text-white transition-colors">Results</a>
                <a href="/leaderboard" className="text-slate-400 hover:text-white transition-colors">Board</a>
                <a href="/stats" className="text-slate-400 hover:text-white transition-colors">Stats</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
