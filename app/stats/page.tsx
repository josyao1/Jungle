'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, Player, Stat, isPlayerInjured, getRosterForGame } from '@/lib/constants'
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
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all')
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [weeklyStats, setWeeklyStats] = useState<Map<number, PlayerStats[]>>(new Map())
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
    const gameIdMap = new Map(games?.map(g => [g.game_number, g.id]) || [])
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

    // Aggregate season totals
    const aggregated: PlayerStats[] = PLAYERS.map(player => {
      const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}

      STATS.forEach(stat => {
        const playerResults = results.filter(r => r.player === player && r.stat === stat)
        const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
        const gamesCount = playerResults.length
        const perGame = gamesCount > 0 ? Math.round((total / gamesCount) * 10) / 10 : 0

        statsObj[stat] = { total, games: gamesCount, perGame }
      })

      return {
        player,
        stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>
      }
    })

    setPlayerStats(aggregated)

    // Aggregate per-week stats
    const weeklyMap = new Map<number, PlayerStats[]>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      if (!gameId) return

      const weekStats: PlayerStats[] = PLAYERS.map(player => {
        const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}

        STATS.forEach(stat => {
          const playerResults = results.filter(r =>
            r.player === player && r.stat === stat && gameMap.get(r.game_id) === g.number
          )
          const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
          statsObj[stat] = { total, games: playerResults.length > 0 ? 1 : 0, perGame: total }
        })

        return {
          player,
          stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>
        }
      })

      weeklyMap.set(g.number, weekStats)
    })

    setWeeklyStats(weeklyMap)
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

  const displayStats = selectedWeek === 'all'
    ? playerStats
    : weeklyStats.get(selectedWeek) || []

  const sortedStats = [...displayStats].sort((a, b) => {
    let comparison = 0
    if (sortColumn === 'player') {
      comparison = a.player.localeCompare(b.player)
    } else {
      const aVal = mode === 'total' || selectedWeek !== 'all' ? a.stats[sortColumn].total : a.stats[sortColumn].perGame
      const bVal = mode === 'total' || selectedWeek !== 'all' ? b.stats[sortColumn].total : b.stats[sortColumn].perGame
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">
          {selectedWeek === 'all' ? 'Season Stats' : `${GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`} Stats`}
        </h1>
        {selectedWeek === 'all' && (
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
        )}
      </div>

      <div className="week-selector">
        <button
          onClick={() => setSelectedWeek('all')}
          className={`week-btn ${selectedWeek === 'all' ? 'active' : ''}`}
        >
          Season
        </button>
        {GAMES.map(g => (
          <button
            key={g.number}
            onClick={() => setSelectedWeek(g.number)}
            className={`week-btn ${selectedWeek === g.number ? 'active' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-x-auto mobile-scroll">
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
            {sortedStats
              .filter(({ player }) => selectedWeek === 'all' || getRosterForGame(selectedWeek as number).includes(player as Player))
              .map(({ player, stats }) => {
              const injured = selectedWeek === 'all' ? isPlayerInjured(player as Player) : isPlayerInjured(player as Player, selectedWeek as number)
              return (
              <tr key={player} className={injured ? 'player-injured' : ''}>
                <td className="capitalize font-medium">
                  {player}
                  {injured && <span className="badge badge-ir ml-2">IR</span>}
                </td>
                {STATS.map(stat => (
                  <td key={stat} className="text-center">
                    <span className="font-medium stat-value">
                      {selectedWeek === 'all'
                        ? (mode === 'total' ? stats[stat].total : stats[stat].perGame)
                        : stats[stat].total}
                    </span>
                    {selectedWeek === 'all' && mode === 'perGame' && stats[stat].games > 0 && (
                      <span className="text-slate-500 text-xs ml-1">
                        ({stats[stat].games}g)
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div className="text-slate-500 text-sm">
        {selectedWeek === 'all'
          ? (mode === 'perGame'
            ? 'Per game averages only include games where the stat was tracked.'
            : 'Totals across all games played this season.')
          : `Stats from ${GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`}.`}
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Weekly Team MVPs</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 min-w-max md:min-w-0">
            {weeklyMVPs.map(({ week, mvp }) => {
              const game = GAMES.find(g => g.number === week)
              const mvpSubtext: Record<number, string> = {
                1: '9-0 run to give us control',
                2: 'Stat Sheet Stuffer',
              }
              return (
                <div key={week} className="glass-card rounded-xl p-3 md:p-4 text-center w-32 md:w-auto flex-shrink-0 md:flex-shrink">
                  <div className="text-slate-500 text-xs md:text-sm mb-1">{game?.label || `Week ${week}`}</div>
                  <div className="text-base md:text-lg font-semibold capitalize">
                    {mvp || <span className="text-slate-600">TBD</span>}
                  </div>
                  {mvpSubtext[week] && (
                    <div className="text-xs text-slate-500 mt-2 italic line-clamp-2">
                      "{mvpSubtext[week]}"
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Season Schedule</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 min-w-max md:min-w-0">
            {/* Week 1 - Played */}
            <div className="glass-card rounded-xl p-3 md:p-4 text-center border border-green-500/30 w-36 md:w-auto flex-shrink-0 md:flex-shrink">
              <div className="text-slate-500 text-xs mb-1">Feb 2</div>
              <div className="text-sm font-medium text-slate-300 mb-2">vs Glurt</div>
              <div className="text-xl font-bold stat-positive">W</div>
              <div className="text-sm text-slate-400 mt-1">30-12</div>
            </div>

            {/* Week 2 - Upcoming */}
            <div className="glass-card rounded-xl p-3 md:p-4 text-center w-36 md:w-auto flex-shrink-0 md:flex-shrink">
              <div className="text-slate-500 text-xs mb-1">Feb 9</div>
              <div className="text-sm font-medium text-slate-300 mb-2">vs Future Doctors</div>
              <div className="text-xl font-bold stat-positive">W</div>
              <div className="text-sm text-slate-400 mt-1">25-19</div>
        
            </div>

            {/* Week 3 - Upcoming */}
            <div className="glass-card rounded-xl p-3 md:p-4 text-center w-36 md:w-auto flex-shrink-0 md:flex-shrink">
              <div className="text-slate-500 text-xs mb-1">Feb 16</div>
              <div className="text-sm font-medium text-slate-300 mb-2">vs McCormick</div>
              <div className="text-xl font-bold stat-negative">L</div>
              <div className="text-sm text-slate-400 mt-1">25-35</div>
              
            </div>

            {/* Week 4 - Upcoming */}
            <div className="glass-card rounded-xl p-3 md:p-4 text-center w-36 md:w-auto flex-shrink-0 md:flex-shrink">
              <div className="text-slate-500 text-xs mb-1">Feb 23</div>
              <div className="text-sm font-medium text-slate-300 mb-2">vs Unwritten</div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="w-4 h-4 rounded-full bg-purple-600"></span>
                <span className="text-xs text-slate-500">Purple</span>
              </div>
            </div>

            {/* Playoff 1 */}
            <div className="glass-card rounded-xl p-3 md:p-4 text-center w-36 md:w-auto flex-shrink-0 md:flex-shrink">
              <div className="text-slate-500 text-xs mb-1">Mar 2</div>
              <div className="text-sm font-medium text-slate-300 mb-2">Playoff 1</div>
              <div className="text-slate-600 text-sm mt-4">TBD</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
