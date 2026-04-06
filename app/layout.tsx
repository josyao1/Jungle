/**
 * Root layout for the Jungle Softball Sportsbook.
 * Renders the navigation bar and wraps all pages.
 * Nav includes an Admin link (visible to all, but access-gated to Joshua on the page).
 */
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JUNGLE',
  description: 'Softball Sportsbook',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="glass-card border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold tracking-wide">
                <span className="text-gradient-brand">JUNGLE</span>
              </a>
              <div className="flex gap-4 md:gap-6 text-sm font-medium">
                <a href="/set-lines" className="text-slate-400 hover:text-white transition-colors">Lines</a>
                <a href="/pick" className="text-slate-400 hover:text-white transition-colors">Picks</a>
                <a href="/results" className="text-slate-400 hover:text-white transition-colors">Results</a>
                <a href="/leaderboard" className="text-slate-400 hover:text-white transition-colors">Board</a>
                <a href="/stats" className="text-slate-400 hover:text-white transition-colors">Stats</a>
                <a href="/admin" className="text-slate-600 hover:text-slate-400 transition-colors">Admin</a>
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
