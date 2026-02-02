import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jungle Sportsbook',
  description: 'IM Basketball Team Sportsbook',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <a href="/" className="text-xl font-bold text-green-400">🏀 Jungle</a>
              <div className="flex gap-4 text-sm">
                <a href="/set-lines" className="hover:text-green-400">Set Lines</a>
                <a href="/pick" className="hover:text-green-400">Pick</a>
                <a href="/results" className="hover:text-green-400">Results</a>
                <a href="/leaderboard" className="hover:text-green-400">Leaderboard</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
