'use client'

export const dynamic = 'force-dynamic'

/**
 * Stats page — Season and per-week player stats.
 * Includes batting average (BA = hits/AB) computed from results data.
 * Inactive players still appear in weekly views, sorted to the bottom with OUT badge.
 * Team MVP + highlight blurb (set by admin) shown below schedule.
 */

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, sortWithInactiveAtBottom, Stat } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface PlayerStats {
  player: string
  stats: Record<Stat, { total: number; games: number; perGame: number }>
  totalHits: number
  totalAb: number
}

interface WeeklyHighlight {
  mvp_player: string | null
  mvp_blurb: string | null
}

type SortColumn = 'player' | Stat | 'ba'
type SortDirection = 'asc' | 'desc'

const PLAYER_HUES: Record<string, string> = {
  joshua:'#22c55e', ronit:'#f59e0b', aarnav:'#06b6d4', evan:'#a855f7',
  andrew:'#f97316', rohit:'#ec4899', teja:'#10b981', aiyan:'#3b82f6',
  salil:'#eab308', Jay:'#8b5cf6', Tommy:'#84cc16', Neo:'#d946ef',
}
const PLAYERS_WITH_PHOTOS = new Set(['joshua','ronit','aarnav','evan','andrew','rohit','teja','aiyan','salil','Jay','Tommy','Neo'])

function formatBA(hits: number, ab: number): string {
  if (ab === 0) return '.---'
  const ba = hits / ab
  return '.' + Math.round(ba * 1000).toString().padStart(3, '0')
}

export default function StatsPage() {
  const [mode, setMode] = useState<'total' | 'perGame'>('total')
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all')
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [weeklyStats, setWeeklyStats] = useState<Map<number, PlayerStats[]>>(new Map())
  const [forfeitedWeeks, setForfeitedWeeks] = useState<Set<number>>(new Set())
  // Map<gameNumber, Map<playerName, reason>>
  const [weeklyInactive, setWeeklyInactive] = useState<Map<number, Map<string, string>>>(new Map())
  const [weeklyHighlights, setWeeklyHighlights] = useState<Map<number, WeeklyHighlight>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('player')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const loadData = useCallback(async () => {
    const [{ data: results }, { data: games }, { data: availData }, { data: highlights }] = await Promise.all([
      supabase.from('jungle_results').select('*'),
      supabase.from('jungle_games').select('id, game_number, forfeited'),
      supabase.from('jungle_player_availability').select('game_id, player, active, reason'),
      supabase.from('jungle_weekly_highlights').select('game_id, mvp_player, mvp_blurb'),
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

    // Build inactive players per game number (Map<player, reason>)
    const inactiveByGame = new Map<number, Map<string, string>>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      if (!gameId) { inactiveByGame.set(g.number, new Map()); return }
      const gameAvail = availData?.filter((a: any) => a.game_id === gameId) || []
      const inactiveMap = new Map<string, string>()
      gameAvail.filter((a: any) => !a.active).forEach((a: any) => {
        inactiveMap.set(a.player, a.reason || 'OUT')
      })
      inactiveByGame.set(g.number, inactiveMap)
    })
    setWeeklyInactive(inactiveByGame)

    const activeByGame = new Map<number, string[]>()
    inactiveByGame.forEach((inactiveMap, gameNum) => {
      activeByGame.set(gameNum, PLAYERS.filter(p => !inactiveMap.has(p)))
    })

    // Build highlights map (game_number -> highlight)
    const highlightMap = new Map<number, WeeklyHighlight>()
    highlights?.forEach((h: any) => {
      const gameNum = gameMap.get(h.game_id)
      if (gameNum) highlightMap.set(gameNum, { mvp_player: h.mvp_player, mvp_blurb: h.mvp_blurb })
    })
    setWeeklyHighlights(highlightMap)

    // Season totals — only count stats from games where player was active
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

      // Season AB for batting average
      const abResults = results.filter(r => {
        const gameNum = gameMap.get(r.game_id)
        if (!gameNum || forfeited.has(gameNum)) return false
        const active = activeByGame.get(gameNum)
        return r.player === player && r.stat === 'ab' && (active?.includes(player) ?? true)
      })
      const totalAb = abResults.reduce((sum, r) => sum + (r.value || 0), 0)
      const totalHits = statsObj['hits']?.total ?? 0

      return { player, stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>, totalHits, totalAb }
    })

    setPlayerStats(aggregated)

    // Per-week stats — include ALL players (inactive shown at bottom with blank stats)
    const weeklyMap = new Map<number, PlayerStats[]>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      const inactiveSet = inactiveByGame.get(g.number) || new Map<string, string>()

      const weekStats: PlayerStats[] = PLAYERS.map(player => {
        const statsObj: Record<string, { total: number; games: number; perGame: number }> = {}
        const isInactive = inactiveSet.has(player)

        STATS.forEach(stat => {
          if (isInactive) {
            statsObj[stat] = { total: 0, games: 0, perGame: 0 }
            return
          }
          const playerResults = gameId
            ? results.filter(r => r.player === player && r.stat === stat && gameMap.get(r.game_id) === g.number)
            : []
          const total = playerResults.reduce((sum, r) => sum + (r.value || 0), 0)
          statsObj[stat] = { total, games: playerResults.length > 0 ? 1 : 0, perGame: total }
        })

        const weekAb = (!isInactive && gameId)
          ? results.filter(r => r.player === player && r.stat === 'ab' && gameMap.get(r.game_id) === g.number)
              .reduce((sum, r) => sum + (r.value || 0), 0)
          : 0
        const weekHits = statsObj['hits']?.total ?? 0

        return { player, stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>, totalHits: weekHits, totalAb: weekAb }
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

  const currentInactive = selectedWeek !== 'all' ? (weeklyInactive.get(selectedWeek as number) ?? new Map<string, string>()) : new Map<string, string>()

  const sortedStats = [...displayStats].sort((a, b) => {
    let comparison = 0
    if (sortColumn === 'player') {
      comparison = a.player.localeCompare(b.player)
    } else if (sortColumn === 'ba') {
      const aBA = a.totalAb > 0 ? a.totalHits / a.totalAb : 0
      const bBA = b.totalAb > 0 ? b.totalHits / b.totalAb : 0
      comparison = aBA - bBA
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

      <div className="glass-card rounded-2xl p-3 md:p-4 overflow-x-auto mobile-scroll">
        <div style={{ minWidth: '710px', width: '100%' }}>
        {/* Column headers */}
        <div className="grid items-center pb-2 mb-1 px-2"
          style={{
            gridTemplateColumns: 'minmax(180px,1fr) minmax(90px,1fr) minmax(70px,1fr) minmax(110px,1fr) minmax(90px,1fr) minmax(100px,1fr) minmax(70px,1fr)',
            borderBottom: '1px solid rgba(34,197,94,0.07)',
          }}>
          <button onClick={() => handleSort('player')} className="flex items-center gap-1 text-xs text-slate-600 uppercase tracking-wider font-bold hover:text-slate-300 transition-colors select-none text-left">
            Player <SortIcon column="player" />
          </button>
          {STATS.map(stat => (
            <button key={stat} onClick={() => handleSort(stat)}
              className="flex items-center justify-center gap-1 text-xs text-slate-600 uppercase tracking-wider font-bold hover:text-slate-300 transition-colors select-none"
              style={{ whiteSpace: 'nowrap' }}>
              {STAT_LABELS[stat]} <SortIcon column={stat} />
            </button>
          ))}
          <button onClick={() => handleSort('ba')}
            className="flex items-center justify-center gap-1 text-xs uppercase tracking-wider font-bold transition-colors select-none"
            style={{ color: 'var(--amber-warm)', opacity: 0.75 }}>
            BA <SortIcon column="ba" />
          </button>
        </div>

        {/* Player card rows */}
        <div className="space-y-1.5">
          {sortedStats.map(({ player, stats, totalHits, totalAb }) => {
            const isInactiveThisWeek = selectedWeek !== 'all' && (weeklyInactive.get(selectedWeek as number)?.has(player) ?? false)
            const color = PLAYER_HUES[player] || '#22c55e'
            const hasPhoto = PLAYERS_WITH_PHOTOS.has(player)

            return (
              <div key={player}
                className="grid items-center rounded-xl px-2 py-2.5"
                style={{
                  gridTemplateColumns: 'minmax(180px,1fr) minmax(90px,1fr) minmax(70px,1fr) minmax(110px,1fr) minmax(90px,1fr) minmax(100px,1fr) minmax(70px,1fr)',
                  background: isInactiveThisWeek ? 'rgba(6,11,8,0.3)' : 'rgba(15,35,24,0.5)',
                  border: `1px solid ${isInactiveThisWeek ? 'rgba(255,255,255,0.04)' : `${color}12`}`,
                  borderLeft: `3px solid ${isInactiveThisWeek ? 'rgba(100,116,139,0.2)' : color}`,
                  opacity: isInactiveThisWeek ? 0.55 : 1,
                }}>

                {/* Player cell */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: hasPhoto ? undefined : `${color}18`, border: `1.5px solid ${color}40` }}>
                    {hasPhoto
                      ? <img src={`/players/${player.toLowerCase()}.png`} alt={player} className="w-full h-full object-cover" />
                      : <span style={{ color, fontSize: '0.6rem', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{player.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <span className="capitalize text-sm font-semibold text-slate-200 truncate block">{player}</span>
                    {isInactiveThisWeek && (
                      <span className="badge badge-out">{weeklyInactive.get(selectedWeek as number)?.get(player) || 'OUT'}</span>
                    )}
                  </div>
                </div>

                {/* Stat value cells */}
                {STATS.map(stat => (
                  <div key={stat} className="text-center">
                    {isInactiveThisWeek ? (
                      <span className="text-slate-700 text-sm">—</span>
                    ) : (
                      <>
                        <span className="font-bold stat-value text-sm">
                          {selectedWeek === 'all'
                            ? (mode === 'total' ? stats[stat].total : stats[stat].perGame)
                            : stats[stat].total}
                        </span>
                        {selectedWeek === 'all' && mode === 'perGame' && stats[stat].games > 0 && (
                          <span className="text-slate-600 text-xs ml-0.5">({stats[stat].games}g)</span>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* BA column */}
                <div className="text-center">
                  {isInactiveThisWeek ? (
                    <span className="text-slate-700 text-sm">—</span>
                  ) : (
                    <span className="font-bold text-sm" style={{ color: 'var(--amber-warm)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatBA(totalHits, totalAb)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </div>

      <div className="text-slate-500 text-sm">
        {selectedWeek === 'all'
          ? (mode === 'perGame'
            ? 'Per game averages only include games where the stat was tracked.'
            : 'Totals across all games. Inactive players and forfeited games excluded.')
          : `Stats from ${GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`}. Inactive players shown at bottom.`}
      </div>

      {/* Season Schedule */}
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

      {/* Team MVP Highlights — 5 blocks like the schedule, one per week */}
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Weekly MVP</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 min-w-max md:min-w-0">
            {GAMES.map(g => {
              const h = weeklyHighlights.get(g.number)
              const mvp = h?.mvp_player
              const hasPhoto = mvp && PLAYERS_WITH_PHOTOS.has(mvp)
              const mvpColor = mvp ? ({
                joshua:'#22c55e', ronit:'#f59e0b', aarnav:'#06b6d4', evan:'#a855f7',
                andrew:'#f97316', rohit:'#ec4899', teja:'#10b981', aiyan:'#3b82f6',
                salil:'#eab308', Jay:'#8b5cf6', Tommy:'#84cc16', Neo:'#d946ef',
              } as Record<string,string>)[mvp] || '#22c55e' : '#22c55e'

              return (
                <div
                  key={g.number}
                  className="glass-card rounded-xl overflow-hidden w-36 md:w-auto flex-shrink-0 md:flex-shrink"
                  style={{ border: mvp ? `1px solid ${mvpColor}33` : undefined }}
                >
                  {/* Photo area */}
                  <div className="relative w-full" style={{ aspectRatio: '1 / 1', background: 'rgba(6,11,8,0.8)' }}>
                    {mvp && hasPhoto ? (
                      <img
                        src={`/players/${mvp.toLowerCase()}.png`}
                        alt={mvp}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                    ) : mvp ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: `radial-gradient(circle at 40% 35%, ${mvpColor}20, transparent)`,
                          color: mvpColor,
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: '2rem',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {mvp.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-xs uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        TBD
                      </div>
                    )}
                    {/* Amber overlay gradient for MVP glow */}
                    {mvp && (
                      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(to top, ${mvpColor}60, transparent)` }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5 text-center">
                    <div className="text-slate-500 text-xs mb-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {g.label}
                    </div>
                    {mvp ? (
                      <>
                        <div className="font-bold capitalize text-sm" style={{ color: mvpColor, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em', fontSize: '0.95rem' }}>
                          ★ {mvp}
                        </div>
                        {h?.mvp_blurb && (
                          <p className="text-slate-500 text-xs mt-1 leading-snug line-clamp-2">{h.mvp_blurb}</p>
                        )}
                      </>
                    ) : (
                      <div className="text-slate-700 text-xs mt-0.5">No MVP yet</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
