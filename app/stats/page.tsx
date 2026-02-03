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

type SortColumn = 'player' | Stat
type SortDirection = 'asc' | 'desc'

export default function StatsPage() {
  const [mode, setMode] = useState<'total' | 'perGame'>('total')
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [weeklyMVPs, setWeeklyMVPs] = useState<WeeklyMVP[]>([])
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('player')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const loadData = useCallback(async () => {
    const [{ data: results }, { data: games }, { data: propResults }] = await Promise.all([
      supabase.from('results').select('*'),
      supabase.from('games').select('id, game_number'),
      supabase.from('prop_results').select('*').eq('prop_type', 'team_mvp')
    ])

    if (!results) {
      setLoading(false)
      return
    }

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection(column === 'player' ? 'asc' : 'desc')
    }
  }

  const sortedStats = [...playerStats].sort((a, b) => {
    let comparison = 0
    if (sortColumn === 'player') {
      comparison = a.player.localeCompare(b.player)
    } else {
      const aVal = mode === 'total' ? a.stats[sortColumn].total : a.stats[sortColumn].perGame
      const bVal = mode === 'total' ? b.stats[sortColumn].total : b.stats[sortColumn].perGame
      comparison = aVal - bVal
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-slate-600 ml-1">↕</span>
    }
    return <span className="text-court-accent ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Season Stats</h1>
        <div className="toggle-group">
          <button
            onClick={() => setMode('total')}
            className={`toggle-btn ${mode === 'total' ? 'active' : ''}`}
          >
            Total
          </button>
          <button
            onClick={() => setMode('perGame')}
            className={`toggle-btn ${mode === 'perGame' ? 'active' : ''}`}
          >
            Per Game
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr className="bg-white/[0.02]">
              <th
                className="cursor-pointer hover:text-slate-300 transition-colors select-none"
                onClick={() => handleSort('player')}
              >
                Player<SortIcon column="player" />
              </th>
              {STATS.map(stat => (
                <th
                  key={stat}
                  className="text-center cursor-pointer hover:text-slate-300 transition-colors select-none"
                  onClick={() => handleSort(stat)}
                >
                  {STAT_LABELS[stat]}<SortIcon column={stat} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(({ player, stats }) => (
              <tr key={player}>
                <td className="capitalize font-medium">{player}</td>
                {STATS.map(stat => (
                  <td key={stat} className="text-center">
                    <span className="font-medium stat-value">
                      {mode === 'total' ? stats[stat].total : stats[stat].perGame}
                    </span>
                    {mode === 'perGame' && stats[stat].games > 0 && (
                      <span className="text-slate-500 text-xs ml-1">
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

      <div className="text-slate-500 text-sm">
        {mode === 'perGame'
          ? 'Per game averages only include games where the stat was tracked.'
          : 'Totals across all games played this season.'}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Weekly Team MVPs</h2>
        <div className="grid grid-cols-4 gap-4">
          {weeklyMVPs.map(({ week, mvp }) => {
            const mvpSubtext: Record<number, string> = {
              1: '9-0 run to give us control',
            }
            return (
              <div key={week} className="glass-card rounded-xl p-4 text-center">
                <div className="text-slate-500 text-sm mb-1">Week {week}</div>
                <div className="text-lg font-semibold capitalize">
                  {mvp || <span className="text-slate-600">TBD</span>}
                </div>
                {mvpSubtext[week] && (
                  <div className="text-xs text-slate-500 mt-2 italic">
                    "{mvpSubtext[week]}"
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Season Schedule</h2>
        <div className="grid grid-cols-4 gap-4">
          {/* Week 1 - Played */}
          <div className="glass-card rounded-xl p-4 text-center border border-green-500/30">
            <div className="text-slate-500 text-xs mb-1">Feb 2</div>
            <div className="text-sm font-medium text-slate-300 mb-2">vs Glurt</div>
            <div className="text-xl font-bold stat-positive">W</div>
            <div className="text-sm text-slate-400 mt-1">30-12</div>
          </div>

          {/* Week 2 - Upcoming */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-slate-500 text-xs mb-1">Feb 9</div>
            <div className="text-sm font-medium text-slate-300 mb-2">vs McCormick</div>
            <div className="text-xs text-slate-500 mb-2">(nav & pranav superbowl)</div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full bg-white border border-slate-600"></span>
              <span className="text-xs text-slate-500">White</span>
            </div>
          </div>

          {/* Week 3 - Upcoming */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-slate-500 text-xs mb-1">Feb 16</div>
            <div className="text-sm font-medium text-slate-300 mb-2">vs Future Doctors</div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-4 h-4 rounded-full bg-white border border-slate-600"></span>
              <span className="text-xs text-slate-500">White</span>
            </div>
          </div>

          {/* Week 4 - Upcoming */}
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-slate-500 text-xs mb-1">Feb 23</div>
            <div className="text-sm font-medium text-slate-300 mb-2">vs Unwritten</div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-4 h-4 rounded-full bg-purple-600"></span>
              <span className="text-xs text-slate-500">Purple</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
