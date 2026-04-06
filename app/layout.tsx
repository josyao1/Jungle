/**
 * Root layout for the Jungle Softball Sportsbook.
 * Renders the navigation bar and wraps all pages.
 * Admin nav link is client-gated — only visible when Joshua is selected.
 */
import type { Metadata } from 'next'
import './globals.css'
import AdminNavLink from '@/components/AdminNavLink'

export const metadata: Metadata = {
  title: 'JUNGLE',
  description: 'Softball Sportsbook',
  icons: { icon: '/headshot.png' },
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
          <div className="max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="flex items-center gap-2 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/headshot.png" alt="Jungle" className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover shrink-0" />
                <span className="text-xl md:text-2xl font-bold tracking-wide text-gradient-brand">JUNGLE</span>
              </a>
              {/* Nav links: scrollable on mobile to handle overflow */}
              <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm font-medium overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <a href="/pick" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">Picks</a>
                <a href="/stats" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">Stats</a>
                <a href="/leaderboard" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">Board</a>
                <AdminNavLink />
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
