'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, sortWithInactiveAtBottom, Stat } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface PlayerStats {
  player: string
  stats: Record<Stat, { total: number; games: number; perGame: number }>
}

type SortColumn = 'player' | Stat
type SortDirection = 'asc' | 'desc'

export default function StatsPage() {
  const [mode, setMode] = useState<'total' | 'perGame'>('total')
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all')
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [weeklyStats, setWeeklyStats] = useState<Map<number, PlayerStats[]>>(new Map())
  // Track which players were active per game for filtering
  const [weeklyActivePlayers, setWeeklyActivePlayers] = useState<Map<number, string[]>>(new Map())
  const [forfeitedWeeks, setForfeitedWeeks] = useState<Set<number>>(new Set())
  // Map of gameNumber -> set of inactive player names for that week
  const [weeklyInactive, setWeeklyInactive] = useState<Map<number, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('player')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const loadData = useCallback(async () => {
    const [{ data: results }, { data: games }, { data: availData }] = await Promise.all([
      supabase.from('jungle_results').select('*'),
      supabase.from('jungle_games').select('id, game_number, forfeited'),
      supabase.from('jungle_player_availability').select('game_id, player, active'),
    ])

    if (!results) { setLoading(false); return }

    const gameMap = new Map(games?.map(g => [g.id, g.game_number]) || [])
    const gameIdMap = new Map(games?.map(g => [g.game_number, g.id]) || [])

    // Track forfeited weeks
    const forfeited = new Set<number>()
    games?.forEach((g: any) => {
      if (g.forfeited) forfeited.add(g.game_number)
    })
    setForfeitedWeeks(forfeited)

    // Build inactive players per game number
    const inactiveByGame = new Map<number, Set<string>>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      if (!gameId) { inactiveByGame.set(g.number, new Set()); return }
      const gameAvail = availData?.filter((a: any) => a.game_id === gameId) || []
      const inactiveSet = new Set(gameAvail.filter((a: any) => !a.active).map((a: any) => a.player))
      inactiveByGame.set(g.number, inactiveSet)
    })
    setWeeklyInactive(inactiveByGame)

    // Keep activeByGame for season total calculations (exclude inactive from totals)
    const activeByGame = new Map<number, string[]>()
    inactiveByGame.forEach((inactiveSet, gameNum) => {
      activeByGame.set(gameNum, PLAYERS.filter(p => !inactiveSet.has(p)))
    })

    // Season totals - only count stats from games where player was active
    const aggregated: PlayerStats[] = PLAYERS.map(player => {
      const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}

      STATS.forEach(stat => {
        const playerResults = results.filter(r => {
          const gameNum = gameMap.get(r.game_id)
          if (!gameNum) return false
          if (forfeited.has(gameNum)) return false
          const active = activeByGame.get(gameNum)
          return r.player === player && r.stat === stat && (active?.includes(player) ?? true)
        })
        const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
        const gamesCount = playerResults.length
        const perGame = gamesCount > 0 ? Math.round((total / gamesCount) * 10) / 10 : 0
        statsObj[stat] = { total, games: gamesCount, perGame }
      })

      return { player, stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }> }
    })

    setPlayerStats(aggregated)

    // Per-week stats
    const weeklyMap = new Map<number, PlayerStats[]>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      const active = activeByGame.get(g.number) || [...PLAYERS]

      const weekStats: PlayerStats[] = active.map(player => {
        const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}

        STATS.forEach(stat => {
          const playerResults = gameId
            ? results.filter(r => r.player === player && r.stat === stat && gameMap.get(r.game_id) === g.number)
            : []
          const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
          statsObj[stat] = { total, games: playerResults.length > 0 ? 1 : 0, perGame: total }
        })

        return { player, stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }> }
      })

      weeklyMap.set(g.number, weekStats)
    })

    setWeeklyStats(weeklyMap)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

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

  const currentInactive = selectedWeek !== 'all' ? (weeklyInactive.get(selectedWeek as number) ?? new Set<string>()) : new Set<string>()

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
  }).sort((a, b) => {
    // Inactive players always sink to bottom regardless of sort column
    const aOut = currentInactive.has(a.player) ? 1 : 0
    const bOut = currentInactive.has(b.player) ? 1 : 0
    return aOut - bOut
  })

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-emerald-400 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">
          {selectedWeek === 'all' ? 'Season Stats' : `${GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`} Stats`}
        </h1>
        {selectedWeek === 'all' && (
          <div className="toggle-group">
            <button onClick={() => setMode('total')} className={`toggle-btn ${mode === 'total' ? 'active' : ''}`}>Total</button>
            <button onClick={() => setMode('perGame')} className={`toggle-btn ${mode === 'perGame' ? 'active' : ''}`}>Per Game</button>
          </div>
        )}
      </div>

      <div className="week-selector">
        <button onClick={() => setSelectedWeek('all')} className={`week-btn ${selectedWeek === 'all' ? 'active' : ''}`}>Season</button>
        {GAMES.map(g => (
          <button key={g.number} onClick={() => setSelectedWeek(g.number)} className={`week-btn ${selectedWeek === g.number ? 'active' : ''}`}>
            {g.label}
            {forfeitedWeeks.has(g.number) && <span className="ml-1 text-red-400 text-xs">✕</span>}
          </button>
        ))}
      </div>

      {selectedWeek !== 'all' && forfeitedWeeks.has(selectedWeek) && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30">
          <p className="text-red-400 text-sm">This game was forfeited. Stats may be incomplete.</p>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-x-auto mobile-scroll">
        <table className="glass-table">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="cursor-pointer hover:text-slate-300 transition-colors select-none" onClick={() => handleSort('player')}>
                Player<SortIcon column="player" />
              </th>
              {STATS.map(stat => (
                <th key={stat} className="text-center cursor-pointer hover:text-slate-300 transition-colors select-none" onClick={() => handleSort(stat)}>
                  {STAT_LABELS[stat]}<SortIcon column={stat} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(({ player, stats }) => {
              const isInactiveThisWeek = selectedWeek !== 'all' && (weeklyInactive.get(selectedWeek as number)?.has(player) ?? false)
              return (
                <tr key={player} className={isInactiveThisWeek ? 'player-inactive' : ''}>
                  <td className="capitalize font-medium">
                    <span>{player}</span>
                    {isInactiveThisWeek && <span className="badge badge-out ml-2">OUT</span>}
                  </td>
                  {STATS.map(stat => (
                    <td key={stat} className="text-center">
                      {isInactiveThisWeek ? (
                        <span className="text-slate-700">—</span>
                      ) : (
                        <>
                          <span className="font-medium stat-value">
                            {selectedWeek === 'all'
                              ? (mode === 'total' ? stats[stat].total : stats[stat].perGame)
                              : stats[stat].total}
                          </span>
                          {selectedWeek === 'all' && mode === 'perGame' && stats[stat].games > 0 && (
                            <span className="text-slate-500 text-xs ml-1">({stats[stat].games}g)</span>
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="text-slate-500 text-sm">
        {selectedWeek === 'all'
          ? (mode === 'perGame'
            ? 'Per game averages only include games where the stat was tracked.'
            : 'Totals across all games. Inactive players and forfeited games excluded.')
          : `Stats from ${GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`}. Only active players shown.`}
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Season Schedule</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 min-w-max md:min-w-0">
            {GAMES.map(g => {
              const isForfeited = forfeitedWeeks.has(g.number)
              const dateLabel: Record<number, string> = { 1: 'Apr 12', 2: 'Apr 19', 3: 'Apr 26', 4: 'May 3', 5: 'May 10' }
              return (
                <div key={g.number}
                  className={`glass-card rounded-xl p-3 md:p-4 text-center w-36 md:w-auto flex-shrink-0 md:flex-shrink ${isForfeited ? 'border border-red-500/30' : ''}`}>
                  <div className="text-slate-500 text-xs mb-1">
                    {dateLabel[g.number] || `Week ${g.number}`}
                  </div>
                  <div className="text-sm font-medium text-slate-300 mb-2">{g.label}</div>
                  {isForfeited ? (
                    <div className="text-red-400 text-sm font-semibold">FORFEITED</div>
                  ) : (
                    <div className="text-slate-600 text-sm mt-2">TBD</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
