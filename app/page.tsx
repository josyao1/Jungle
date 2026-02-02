'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import PlayerSelect from '@/components/PlayerSelect'
import GameStatus from '@/components/GameStatus'
import { Player, PLAYERS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [leaderboard, setLeaderboard] = useState<Array<{ player: string; total: number }>>([])

  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('scores')
      .select('player, total_points')

    if (data) {
      // Aggregate by player
      const totals = new Map<string, number>()
      PLAYERS.forEach(p => totals.set(p, 0))
      data.forEach(row => {
        const current = totals.get(row.player) || 0
        totals.set(row.player, current + (row.total_points || 0))
      })

      const sorted = Array.from(totals.entries())
        .map(([player, total]) => ({ player, total }))
        .sort((a, b) => b.total - a.total)

      setLeaderboard(sorted)
    }
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Jungle Sportsbook</h1>
        <p className="text-gray-400">IM Basketball • Set lines, make picks, win glory</p>
      </div>

      <PlayerSelect onSelect={setPlayer} selected={player} />

      {player && (
        <>
          <GameStatus />

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.player}
                  className={`flex items-center justify-between p-2 rounded ${
                    entry.player === player ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <span className="capitalize">{entry.player}</span>
                  </div>
                  <span className="font-mono">{entry.total} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href="/set-lines"
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-1">📊</div>
              <div className="font-medium">Set Lines</div>
              <div className="text-gray-400 text-sm">Predict stats</div>
            </a>
            <a
              href="/pick"
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-1">🎯</div>
              <div className="font-medium">Make Picks</div>
              <div className="text-gray-400 text-sm">Bet on overs</div>
            </a>
            <a
              href="/results"
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-1">📝</div>
              <div className="font-medium">Enter Results</div>
              <div className="text-gray-400 text-sm">After game</div>
            </a>
            <a
              href="/leaderboard"
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-1">🏆</div>
              <div className="font-medium">Leaderboard</div>
              <div className="text-gray-400 text-sm">Full standings</div>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
