'use client'

export const dynamic = 'force-dynamic'

/**
 * Stats page — Season and per-week player stats.
 * Includes batting average (BA = hits/AB) computed from results data.
 * Inactive players still appear in weekly views, sorted to the bottom with OUT badge.
 * Team MVP + highlight blurb (set by admin) shown below schedule.
 */

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, getPlayersForGame, WEEK1_ONLY_PLAYERS, WEEK2_PLUS_PLAYERS, Stat, PLAYER_HUES, PLAYERS_WITH_PHOTOS, PROP_BET_LABELS, PROP_BETS } from '@/lib/constants'
import PlayerAvatar from '@/components/PlayerAvatar'
import { supabase } from '@/lib/supabase'

interface PlayerStats {
  player: string
  stats: Record<Stat, { total: number; games: number; perGame: number }>
  totalHits: number
  totalAb: number
  totalIp: number
  totalRunsAllowed: number
  totalHomeruns: number
  gamesPlayed: number
}

// Hitting stats shown in the top table (K moves to pitching section)
const HITTING_STATS: Stat[] = ['hits', 'rbis', 'runs', 'errors']

interface WeeklyHighlight {
  mvp_player: string | null
  mvp_blurb: string | null
}

type SortColumn = 'player' | Stat | 'ba'
type SortDirection = 'asc' | 'desc'


// Athlete-style display names for the stats page only
const ATHLETE_NAMES: Record<string, string> = {
  joshua: 'J. Yao',
  evan:   'E. Smith',
  aarnav: 'A. Patel',
  salil:  'S. Chandramohan',
  aiyan:  'A. Sanjanwala',
  Jay:    'J. Diffley',
  andrew: 'A. Hong',
  ronit:  'R. Mehta',
  rohit:  'R. Katakam',
  teja:   'A. Siluveru',
  Neo:    'N. Trovela-Villamiel',
  Tommy:  'T. Matthys',
  Alan:   'Shohei',
}

function formatBA(hits: number, ab: number): string {
  if (ab === 0) return '.---'
  const rounded = Math.round((hits / ab) * 1000)
  if (rounded >= 1000) return '1.000'
  return '.' + rounded.toString().padStart(3, '0')
}

// IP is stored as thirds-of-an-inning in the DB (e.g. 1.1 innings = 4 thirds)
function thirdsToIpDisplay(thirds: number): string {
  if (thirds === 0) return '0'
  const full = Math.floor(thirds / 3)
  const rem = thirds % 3
  return rem > 0 ? `${full}.${rem}` : `${full}`
}

// ERA for softball: (runsAllowed / actualInnings) * 7
// thirds = total innings pitched stored as thirds
function formatERA(runsAllowed: number, thirds: number): string {
  if (thirds === 0) return '—'
  return ((runsAllowed / (thirds / 3)) * 7).toFixed(2)
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
  const [weeklyPropResults, setWeeklyPropResults] = useState<Map<number, Record<string, { winners: string[], blurb: string }>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('ba')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const loadData = useCallback(async () => {
    const [{ data: results }, { data: games }, { data: availData }, { data: highlights }, { data: propResultsData }] = await Promise.all([
      supabase.from('jungle_results').select('*'),
      supabase.from('jungle_games').select('id, game_number, forfeited'),
      supabase.from('jungle_player_availability').select('game_id, player, active, reason'),
      supabase.from('jungle_weekly_highlights').select('game_id, mvp_player, mvp_blurb'),
      supabase.from('jungle_prop_results').select('*'),
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

    // Track which game numbers have results entered (only these count toward GP)
    const gamesWithResults = new Set<number>()
    results.forEach(r => {
      const gameNum = gameMap.get(r.game_id)
      if (gameNum) gamesWithResults.add(gameNum)
    })

    // Build highlights map (game_number -> highlight)
    const highlightMap = new Map<number, WeeklyHighlight>()
    highlights?.forEach((h: any) => {
      const gameNum = gameMap.get(h.game_id)
      if (gameNum) highlightMap.set(gameNum, { mvp_player: h.mvp_player, mvp_blurb: h.mvp_blurb })
    })
    setWeeklyHighlights(highlightMap)

    // Build prop results map: gameNumber → { propType → { winners, blurb } }
    const propMap = new Map<number, Record<string, { winners: string[], blurb: string }>>()
    propResultsData?.forEach((pr: any) => {
      const gameNum = gameMap.get(pr.game_id)
      if (!gameNum) return
      if (!propMap.has(gameNum)) propMap.set(gameNum, {})
      const entry = propMap.get(gameNum)!
      if (pr.prop_type.endsWith('_blurb')) {
        const base = pr.prop_type.replace('_blurb', '')
        if (!entry[base]) entry[base] = { winners: [], blurb: '' }
        entry[base].blurb = pr.winner
      } else {
        if (!entry[pr.prop_type]) entry[pr.prop_type] = { winners: [], blurb: '' }
        entry[pr.prop_type].winners = pr.winner.split(',').map((w: string) => w.trim())
      }
    })
    setWeeklyPropResults(propMap)

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

      const pitchingFilter = (stat: string) => (r: any) => {
        const gameNum = gameMap.get(r.game_id)
        if (!gameNum || forfeited.has(gameNum)) return false
        const active = activeByGame.get(gameNum)
        return r.player === player && r.stat === stat && (active?.includes(player) ?? true)
      }

      const totalAb = results.filter(pitchingFilter('ab')).reduce((sum, r) => sum + (r.value || 0), 0)
      const totalIp = results.filter(pitchingFilter('ip')).reduce((sum, r) => sum + (r.value || 0), 0)
      const totalRunsAllowed = results.filter(pitchingFilter('runs_allowed')).reduce((sum, r) => sum + (r.value || 0), 0)
      const totalHomeruns = results.filter(pitchingFilter('homeruns')).reduce((sum, r) => sum + (r.value || 0), 0)
      const totalHits = statsObj['hits']?.total ?? 0

      // GP = distinct games where stats were actually recorded for this player (not just "active")
      const gamesPlayed = new Set(
        results
          .filter(r => r.player === player && !forfeited.has(gameMap.get(r.game_id) ?? -1))
          .map(r => r.game_id)
      ).size

      return { player, stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>, totalHits, totalAb, totalIp, totalRunsAllowed, totalHomeruns, gamesPlayed }
    })

    setPlayerStats(aggregated)

    // Per-week stats — include only eligible players per game (Alan/Reis week 1 only)
    const weeklyMap = new Map<number, PlayerStats[]>()
    GAMES.forEach(g => {
      const gameId = gameIdMap.get(g.number)
      const inactiveSet = inactiveByGame.get(g.number) || new Map<string, string>()
      const gamePlayers = getPlayersForGame(g.number)

      const weekStats: PlayerStats[] = gamePlayers.map(player => {
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

        const weekStat = (stat: string) => (!isInactive && gameId)
          ? results.filter(r => r.player === player && r.stat === stat && gameMap.get(r.game_id) === g.number)
              .reduce((sum, r) => sum + (r.value || 0), 0)
          : 0
        const weekHits = statsObj['hits']?.total ?? 0

        return {
          player,
          stats: statsObj as Record<Stat, { total: number; games: number; perGame: number }>,
          totalHits: weekHits,
          totalAb: weekStat('ab'),
          totalIp: weekStat('ip'),
          totalRunsAllowed: weekStat('runs_allowed'),
          totalHomeruns: weekStat('homeruns'),
          gamesPlayed: isInactive ? 0 : 1,
        }
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
    // Tier 1: inactive always at very bottom
    const aOut = currentInactive.has(a.player) ? 2 : 0
    const bOut = currentInactive.has(b.player) ? 2 : 0
    if (aOut !== bOut) return aOut - bOut

    // Tier 2: guest players (week-1-only or week-2-plus) below the regular roster
    const aGuest = (WEEK1_ONLY_PLAYERS.has(a.player) || WEEK2_PLUS_PLAYERS.has(a.player)) ? 1 : 0
    const bGuest = (WEEK1_ONLY_PLAYERS.has(b.player) || WEEK2_PLUS_PLAYERS.has(b.player)) ? 1 : 0
    if (aGuest !== bGuest) return aGuest - bGuest

    // Tier 3: primary sort column
    let comparison = 0
    if (sortColumn === 'player') {
      comparison = a.player.localeCompare(b.player)
    } else if (sortColumn === 'ba') {
      const aNoAb = a.totalAb === 0
      const bNoAb = b.totalAb === 0
      if (aNoAb !== bNoAb) return aNoAb ? 1 : -1
      comparison = (a.totalHits / a.totalAb) - (b.totalHits / b.totalAb)
    } else {
      const aVal = mode === 'total' || selectedWeek !== 'all' ? a.stats[sortColumn].total : a.stats[sortColumn].perGame
      const bVal = mode === 'total' || selectedWeek !== 'all' ? b.stats[sortColumn].total : b.stats[sortColumn].perGame
      comparison = aVal - bVal
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-emerald-400 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Season Schedule — compact strip */}
      <div className="glass-card rounded-2xl px-4 py-3">
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max md:min-w-0">
            {GAMES.map(g => {
              const isForfeited = forfeitedWeeks.has(g.number)
              const dateLabel = g.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
              const isHome = g.home
              const score = 'finalScore' in g ? g.finalScore : undefined
              const result = 'result' in g ? g.result : undefined
              const isWin = result === 'W'
              return (
                <div key={g.number} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: isHome ? 'rgba(168,85,247,0.08)' : 'rgba(248,250,252,0.04)',
                    border: isForfeited ? '1px solid rgba(239,68,68,0.3)' : isHome ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <span className="text-xs shrink-0" style={{ color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{dateLabel}</span>
                  <span className="text-xs font-semibold" style={{ color: isHome ? '#c084fc' : '#94a3b8' }}>{g.label}</span>
                  {isForfeited
                    ? <span className="text-xs font-bold text-red-400">FORF</span>
                    : score
                      ? <span className="text-xs font-bold shrink-0" style={{ color: isWin ? '#4ade80' : '#f87171', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>{result} {score}</span>
                      : <span className="text-xs" style={{ color: '#475569' }}>vs. {g.opponent}</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>

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

      {/* ── Hitting Stats ── */}
      <div className="glass-card rounded-2xl p-3 md:p-4 overflow-x-auto mobile-scroll">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">Hitting</p>
        <div style={{ minWidth: '580px', width: '100%' }}>
          {/* Column headers */}
          <div className="grid items-center pb-2 mb-1 px-2"
            style={{
              gridTemplateColumns: 'minmax(180px,1fr) repeat(4, minmax(80px,1fr)) minmax(70px,1fr)',
              borderBottom: '1px solid rgba(34,197,94,0.07)',
            }}>
            <button onClick={() => handleSort('player')} className="flex items-center gap-1 text-xs text-slate-600 uppercase tracking-wider font-bold hover:text-slate-300 transition-colors select-none text-left">
              Player <SortIcon column="player" />
            </button>
            {HITTING_STATS.map(stat => (
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

          {/* Player rows */}
          <div className="space-y-1.5">
            {sortedStats.map(({ player, stats, totalHits, totalAb, totalHomeruns, gamesPlayed }) => {
              const isInactiveThisWeek = selectedWeek !== 'all' && (weeklyInactive.get(selectedWeek as number)?.has(player) ?? false)
              const color = PLAYER_HUES[player] || '#22c55e'

              return (
                <div key={player}
                  className="grid items-center rounded-xl px-2 py-2.5"
                  style={{
                    gridTemplateColumns: 'minmax(180px,1fr) repeat(4, minmax(80px,1fr)) minmax(70px,1fr)',
                    background: isInactiveThisWeek ? 'rgba(6,11,8,0.3)' : 'rgba(15,35,24,0.5)',
                    border: `1px solid ${isInactiveThisWeek ? 'rgba(255,255,255,0.04)' : `${color}12`}`,
                    borderLeft: `3px solid ${isInactiveThisWeek ? 'rgba(100,116,139,0.2)' : color}`,
                    opacity: isInactiveThisWeek ? 0.55 : 1,
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar player={player} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200 truncate">{ATHLETE_NAMES[player] ?? player}</span>
                        {!isInactiveThisWeek && selectedWeek === 'all' && gamesPlayed > 0 && (
                          <span className="text-xs shrink-0" style={{ color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>({gamesPlayed}GP)</span>
                        )}
                        {!isInactiveThisWeek && totalHomeruns > 0 && (
                          <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.35)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                            {totalHomeruns} HR
                          </span>
                        )}
                      </div>
                      {isInactiveThisWeek && (
                        <span className="badge badge-out">{weeklyInactive.get(selectedWeek as number)?.get(player) || 'OUT'}</span>
                      )}
                    </div>
                  </div>
                  {HITTING_STATS.map(stat => (
                    <div key={stat} className="text-center">
                      {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
                        <>
                          <span className="font-bold stat-value text-sm">
                            {selectedWeek === 'all' ? (mode === 'total' ? stats[stat].total : stats[stat].perGame) : stats[stat].total}
                          </span>
                          {selectedWeek === 'all' && mode === 'perGame' && stats[stat].games > 0 && (
                            <span className="text-slate-600 text-xs ml-0.5">({stats[stat].games}g)</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  <div className="text-center">
                    {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
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

      {/* ── Pitching Stats ── */}
      <div className="glass-card rounded-2xl p-3 md:p-4 overflow-x-auto mobile-scroll">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">Pitching</p>
        <div style={{ minWidth: '560px', width: '100%' }}>
          <div className="grid items-center pb-2 mb-1 px-2"
            style={{
              gridTemplateColumns: 'minmax(180px,1fr) repeat(4, minmax(80px,1fr))',
              borderBottom: '1px solid rgba(99,102,241,0.1)',
            }}>
            <span className="text-xs text-slate-600 uppercase tracking-wider font-bold">Player</span>
            {(['IP', 'R', 'ERA', 'K'] as const).map(h => (
              <span key={h} className="text-center text-xs text-slate-600 uppercase tracking-wider font-bold">{h}</span>
            ))}
          </div>
          {sortedStats.every(({ totalIp, totalRunsAllowed }) => totalIp === 0 && totalRunsAllowed === 0) && (
            <p className="text-slate-600 text-xs px-2 py-3">No pitching stats recorded yet.</p>
          )}
          <div className="space-y-1.5">
            {sortedStats.filter(({ totalIp, totalRunsAllowed }) => totalIp > 0 || totalRunsAllowed > 0).map(({ player, stats, totalIp, totalRunsAllowed }) => {
              const isInactiveThisWeek = selectedWeek !== 'all' && (weeklyInactive.get(selectedWeek as number)?.has(player) ?? false)
              const k = isInactiveThisWeek ? null : (selectedWeek === 'all'
                ? (mode === 'total' ? stats['strikeouts'].total : stats['strikeouts'].perGame)
                : stats['strikeouts'].total)

              return (
                <div key={player}
                  className="grid items-center rounded-xl px-2 py-2.5"
                  style={{
                    gridTemplateColumns: 'minmax(180px,1fr) repeat(4, minmax(80px,1fr))',
                    background: isInactiveThisWeek ? 'rgba(6,11,8,0.3)' : 'rgba(15,24,35,0.5)',
                    border: `1px solid ${isInactiveThisWeek ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.08)'}`,
                    borderLeft: `3px solid ${isInactiveThisWeek ? 'rgba(100,116,139,0.2)' : 'rgba(99,102,241,0.4)'}`,
                    opacity: isInactiveThisWeek ? 0.55 : 1,
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar player={player} />
                    <span className="text-sm font-semibold text-slate-200 truncate">{ATHLETE_NAMES[player] ?? player}</span>
                  </div>
                  {/* IP */}
                  <div className="text-center">
                    {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
                      <span className="font-bold stat-value text-sm">{thirdsToIpDisplay(totalIp)}</span>
                    )}
                  </div>
                  {/* R (runs allowed) */}
                  <div className="text-center">
                    {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
                      <span className="font-bold stat-value text-sm">{totalRunsAllowed}</span>
                    )}
                  </div>
                  {/* ERA */}
                  <div className="text-center">
                    {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
                      <span className="font-bold text-sm" style={{ color: 'rgba(129,140,248,0.9)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatERA(totalRunsAllowed, totalIp)}
                      </span>
                    )}
                  </div>
                  {/* K */}
                  <div className="text-center">
                    {isInactiveThisWeek ? <span className="text-slate-700 text-sm">—</span> : (
                      <span className="font-bold stat-value text-sm">{k ?? 0}</span>
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

      {/* ── Prop Highlights ── */}
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Prop Highlights</h2>
        <div className="space-y-4">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>{PROP_BET_LABELS[prop]}</p>
              <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex md:grid md:grid-cols-3 gap-2 md:gap-3 min-w-max md:min-w-0">
                  {GAMES.map(g => {
                    const entry = weeklyPropResults.get(g.number)?.[prop]
                    const winners = entry?.winners || []
                    const blurb = entry?.blurb || ''
                    return (
                      <div key={g.number}
                        className="rounded-xl p-3 w-44 md:w-auto flex-shrink-0 md:flex-shrink"
                        style={{
                          background: winners.length > 0 ? 'rgba(15,25,20,0.7)' : 'rgba(6,11,8,0.4)',
                          border: winners.length > 0 ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(255,255,255,0.05)',
                        }}>
                        <div className="text-xs mb-1.5" style={{ color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{g.label}</div>
                        {winners.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {winners.map(w => (
                                <div key={w} className="flex items-center gap-1">
                                  <PlayerAvatar player={w} size={20} objectTop />
                                  <span className="text-xs font-semibold capitalize" style={{ color: PLAYER_HUES[w] || '#22c55e' }}>{w}</span>
                                </div>
                              ))}
                            </div>
                            {blurb && <p className="text-xs leading-snug" style={{ color: '#64748b' }}>{blurb}</p>}
                          </>
                        ) : (
                          <div className="text-xs" style={{ color: '#1e293b' }}>TBD</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team MVP Highlights — 3 blocks like the schedule, one per week */}
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Weekly MVP</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 min-w-max md:min-w-0">
            {GAMES.map(g => {
              const h = weeklyHighlights.get(g.number)
              const mvp = h?.mvp_player
              const hasPhoto = mvp && PLAYERS_WITH_PHOTOS.has(mvp)
              const mvpColor = mvp ? (PLAYER_HUES[mvp] || '#22c55e') : '#22c55e'

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
                          ★ {ATHLETE_NAMES[mvp] ?? mvp}
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
