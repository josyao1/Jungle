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
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-court-accent to-court-orange bg-clip-text text-transparent">
            JUNGLE
          </span>
        </h1>
        <p className="text-slate-500 text-sm">IM Basketball Sportsbook</p>
      </div>

      <PlayerSelect onSelect={setPlayer} selected={player} />

      {player && (
        <>
          <GameStatus />

          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Standings</h2>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.player}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    entry.player === player
                      ? 'bg-court-accent/10 border border-court-accent/30'
                      : 'bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 text-center text-lg font-bold ${
                      i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="capitalize font-medium">{entry.player}</span>
                  </div>
                  <span className={`text-xl font-bold ${i === 0 ? 'stat-value' : 'text-slate-400'}`}>
                    {entry.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a href="/set-lines" className="glass-card glass-card-hover rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">📊</div>
              <div className="text-sm font-medium text-slate-400">Set Lines</div>
            </a>
            <a href="/pick" className="glass-card glass-card-hover rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">🎯</div>
              <div className="text-sm font-medium text-slate-400">Make Picks</div>
            </a>
            <a href="/results" className="glass-card glass-card-hover rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">📝</div>
              <div className="text-sm font-medium text-slate-400">Results</div>
            </a>
            <a href="/leaderboard" className="glass-card glass-card-hover rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">🏆</div>
              <div className="text-sm font-medium text-slate-400">Leaderboard</div>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
