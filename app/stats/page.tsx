'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, Player, Stat } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface PlayerStats {
  player: string
  stats: Record<Stat, { total: number; games: number; perGame: number }>
}

interface WeeklyMVP {
  week: number
  mvp: string | null
}

export default function StatsPage() {
  const [mode, setMode] = useState<'total' | 'perGame'>('total')
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [weeklyMVPs, setWeeklyMVPs] = useState<WeeklyMVP[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    // Fetch results and games
    const [{ data: results }, { data: games }, { data: propResults }] = await Promise.all([
      supabase.from('results').select('*'),
      supabase.from('games').select('id, game_number'),
      supabase.from('prop_results').select('*').eq('prop_type', 'team_mvp')
    ])

    if (!results) {
      setLoading(false)
      return
    }

    // Build weekly MVPs
    const gameMap = new Map(games?.map(g => [g.id, g.game_number]) || [])
    const mvps: WeeklyMVP[] = GAMES.map(g => {
      const propResult = propResults?.find(pr => {
        const gameNum = gameMap.get(pr.game_id)
        return gameNum === g.number
      })
      return {
        week: g.number,
        mvp: propResult?.winner || null
      }
    })
    setWeeklyMVPs(mvps)

    // Aggregate by player
    const aggregated: PlayerStats[] = PLAYERS.map(player => {
      const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}

      STATS.forEach(stat => {
        const playerResults = results.filter(r => r.player === player && r.stat === stat)
        const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
        const games = playerResults.length
        const perGame = games > 0 ? Math.round((total / games) * 10) / 10 : 0

        statsObj[stat] = { total, games, perGame }
      })

      return {
        player,
        stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>
      }
    })

    setPlayerStats(aggregated)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Season Stats</h1>
        <div className="flex bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setMode('total')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'total'
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Total
          </button>
          <button
            onClick={() => setMode('perGame')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'perGame'
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Per Game
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-4 py-3 text-left">Player</th>
              {STATS.map(stat => (
                <th key={stat} className="px-4 py-3 text-center">
                  {STAT_LABELS[stat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerStats.map(({ player, stats }) => (
              <tr key={player} className="border-t border-gray-700">
                <td className="px-4 py-3 capitalize font-medium">{player}</td>
                {STATS.map(stat => (
                  <td key={stat} className="px-4 py-3 text-center">
                    <span className="font-mono">
                      {mode === 'total' ? stats[stat].total : stats[stat].perGame}
                    </span>
                    {mode === 'perGame' && stats[stat].games > 0 && (
                      <span className="text-gray-500 text-xs ml-1">
                        ({stats[stat].games}g)
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-gray-400 text-sm">
        {mode === 'perGame'
          ? 'Per game averages only include games where the stat was tracked.'
          : 'Totals across all games played this season.'}
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Weekly Team MVPs</h2>
        <div className="grid grid-cols-4 gap-4">
          {weeklyMVPs.map(({ week, mvp }) => (
            <div key={week} className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-gray-400 text-sm mb-1">Week {week}</div>
              <div className="text-lg font-medium capitalize">
                {mvp || <span className="text-gray-500">TBD</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
