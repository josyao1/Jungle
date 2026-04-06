'use client'

export const dynamic = 'force-dynamic'

/**
 * Admin page — Joshua-only controls:
 *  - Player availability (per week)
 *  - Forfeit toggle
 *  - Team MVP + game recap blurb
 *  - Stat results entry (with AB for batting average)
 *  - Prop results (biggest disaster)
 *  - Score calculation
 */

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, PROP_BETS, PROP_BET_LABELS, sortWithInactiveAtBottom } from '@/lib/constants'
import { supabase, Result, Line, Pick, getInactivePlayersForGame } from '@/lib/supabase'
import { calculateScores } from '@/lib/utils'

// Stats tracked in results but not used for betting
const ALL_RESULT_STATS = [...STATS, 'ab'] as const

interface GameData {
  id: string
  game_number: number
  forfeited: boolean
}

interface AvailabilityMap {
  [gameId: string]: { [player: string]: { active: boolean; reason: string } }
}

interface HighlightMap {
  [gameId: string]: { mvp_player: string; mvp_blurb: string }
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [games, setGames] = useState<GameData[]>([])
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [highlights, setHighlights] = useState<HighlightMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingHighlight, setSavingHighlight] = useState(false)
  const [selectedGame, setSelectedGame] = useState<number>(1)

  // Results state
  const [results, setResults] = useState<Record<string, Record<string, string>>>({})
  const [propResults, setPropResults] = useState<Record<string, string[]>>({})
  const [inactivePlayers, setInactivePlayers] = useState<Map<string, string>>(new Map())
  const [isForfeited, setIsForfeited] = useState(false)
  const [calculated, setCalculated] = useState(false)
  const [savingResults, setSavingResults] = useState(false)
  const [resultsLoading, setResultsLoading] = useState(false)

  const loadData = useCallback(async () => {
    const savedPlayer = localStorage.getItem('jungle_player')
    setCurrentUser(savedPlayer)

    const [{ data: gamesData }, { data: availData }, { data: highlightData }] = await Promise.all([
      supabase.from('jungle_games').select('id, game_number, forfeited').order('game_number'),
      supabase.from('jungle_player_availability').select('game_id, player, active'),
      supabase.from('jungle_weekly_highlights').select('game_id, mvp_player, mvp_blurb'),
    ])

    if (!gamesData) { setLoading(false); return }

    // Ensure all games exist in DB
    const existingNums = new Set(gamesData.map((g: any) => g.game_number))
    for (const game of GAMES) {
      if (!existingNums.has(game.number)) {
        await supabase.from('jungle_games').insert({
          game_number: game.number,
          game_date: game.date.toISOString(),
          lines_lock_time: game.lockTime.toISOString(),
          picks_lock_time: game.lockTime.toISOString(),
          status: 'upcoming',
          forfeited: false,
        })
      }
    }

    const { data: refreshed } = await supabase
      .from('jungle_games').select('id, game_number, forfeited').order('game_number')

    const gamesList = (refreshed || gamesData) as GameData[]
    setGames(gamesList)

    const availMap: AvailabilityMap = {}
    gamesList.forEach(g => {
      availMap[g.id] = {}
      PLAYERS.forEach(p => { availMap[g.id][p] = { active: true, reason: 'OUT' } })
    })
    availData?.forEach((row: any) => {
      if (availMap[row.game_id]) {
        availMap[row.game_id][row.player] = { active: row.active, reason: row.reason || 'OUT' }
      }
    })
    setAvailability(availMap)

    const hlMap: HighlightMap = {}
    highlightData?.forEach((h: any) => {
      hlMap[h.game_id] = { mvp_player: h.mvp_player || '', mvp_blurb: h.mvp_blurb || '' }
    })
    setHighlights(hlMap)

    setLoading(false)
  }, [])

  // Load results whenever the selected game changes
  const loadResults = useCallback(async (gameId: string, forfeited: boolean) => {
    setResultsLoading(true)
    setIsForfeited(forfeited)

    // Reset state
    const blank: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      blank[p] = {}
      ALL_RESULT_STATS.forEach(s => { blank[p][s] = '' })
    })
    setResults(blank)
    setPropResults({})

    const inactive = await getInactivePlayersForGame(gameId)
    setInactivePlayers(inactive)

    const [{ data: existingResults }, { data: existingPropResults }, { data: scores }] = await Promise.all([
      supabase.from('jungle_results').select('*').eq('game_id', gameId),
      supabase.from('jungle_prop_results').select('*').eq('game_id', gameId),
      supabase.from('jungle_scores').select('id').eq('game_id', gameId).limit(1),
    ])

    if (existingResults && existingResults.length > 0) {
      const loaded: Record<string, Record<string, string>> = {}
      PLAYERS.forEach(p => {
        loaded[p] = {}
        ALL_RESULT_STATS.forEach(s => {
          const r = existingResults.find(r => r.player === p && r.stat === s)
          loaded[p][s] = r ? String(r.value) : ''
        })
      })
      setResults(loaded)
    }

    if (existingPropResults) {
      const loaded: Record<string, string[]> = {}
      existingPropResults.forEach((p: any) => {
        loaded[p.prop_type] = p.winner.split(',').map((w: string) => w.trim())
      })
      setPropResults(loaded)
    }

    setCalculated(!!(scores && scores.length > 0))
    setResultsLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Reload results when selected game or games list changes
  useEffect(() => {
    const currentGame = games.find(g => g.game_number === selectedGame)
    if (currentGame) loadResults(currentGame.id, currentGame.forfeited)
  }, [selectedGame, games, loadResults])

  const togglePlayerAvailability = async (gameId: string, player: string) => {
    const current = availability[gameId]?.[player] ?? { active: true, reason: 'OUT' }
    const newActive = !current.active
    setAvailability(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [player]: { active: newActive, reason: current.reason } },
    }))
    await supabase
      .from('jungle_player_availability')
      .upsert({ game_id: gameId, player, active: newActive, reason: current.reason }, { onConflict: 'game_id,player' })
  }

  const updateAvailabilityReason = async (gameId: string, player: string, reason: string) => {
    setAvailability(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [player]: { ...prev[gameId][player], reason } },
    }))
    // Save immediately
    await supabase
      .from('jungle_player_availability')
      .upsert({ game_id: gameId, player, active: false, reason }, { onConflict: 'game_id,player' })
  }

  const toggleForfeit = async (game: GameData) => {
    const newValue = !game.forfeited
    setSaving(true)
    await supabase.from('jungle_games').update({ forfeited: newValue }).eq('id', game.id)
    setGames(prev => prev.map(g => g.id === game.id ? { ...g, forfeited: newValue } : g))
    setIsForfeited(newValue)
    if (newValue) await supabase.from('jungle_scores').delete().eq('game_id', game.id)
    setSaving(false)
    alert(newValue ? 'Game marked as forfeited. Scores zeroed.' : 'Forfeit removed.')
  }

  const saveHighlight = async (gameId: string) => {
    const h = highlights[gameId]
    if (!h) return
    setSavingHighlight(true)
    await supabase
      .from('jungle_weekly_highlights')
      .upsert({ game_id: gameId, mvp_player: h.mvp_player, mvp_blurb: h.mvp_blurb }, { onConflict: 'game_id' })
    setSavingHighlight(false)
    alert('Highlight saved!')
  }

  const updateHighlight = (gameId: string, field: 'mvp_player' | 'mvp_blurb', value: string) => {
    setHighlights(prev => ({
      ...prev,
      [gameId]: { ...(prev[gameId] || { mvp_player: '', mvp_blurb: '' }), [field]: value },
    }))
  }

  const handleResultChange = (targetPlayer: string, stat: string, value: string) => {
    setResults(prev => ({ ...prev, [targetPlayer]: { ...prev[targetPlayer], [stat]: value } }))
  }

  const handleSubmitResults = async (gameId: string) => {
    setSavingResults(true)
    await supabase.from('jungle_results').delete().eq('game_id', gameId)

    const toInsert: Array<{ game_id: string; player: string; stat: string; value: number }> = []
    PLAYERS.forEach(p => {
      if (inactivePlayers.has(p)) return
      ALL_RESULT_STATS.forEach(s => {
        const val = results[p]?.[s]
        if (val !== '' && val !== undefined) {
          toInsert.push({ game_id: gameId, player: p, stat: s, value: parseInt(val) })
        }
      })
    })
    if (toInsert.length > 0) await supabase.from('jungle_results').insert(toInsert)

    const propToInsert = Object.entries(propResults)
      .filter(([, winners]) => winners && winners.length > 0)
      .map(([propType, winners]) => ({ game_id: gameId, prop_type: propType, winner: winners.join(',') }))
    if (propToInsert.length > 0) {
      await supabase.from('jungle_prop_results').upsert(propToInsert, { onConflict: 'game_id,prop_type' })
    }

    setSavingResults(false)
    alert('Results saved!')
  }

  const handleCalculateScores = async (gameId: string) => {
    setSavingResults(true)

    if (isForfeited) {
      await supabase.from('jungle_scores').delete().eq('game_id', gameId)
      await supabase.from('jungle_scores').insert(
        PLAYERS.map(p => ({ game_id: gameId, player: p, correct_picks: 0, missed_picks: 0, total_points: 0 }))
      )
      setCalculated(true)
      setSavingResults(false)
      alert('Game forfeited — all scores set to 0.')
      return
    }

    const [{ data: lines }, { data: picks }, { data: resultsData }] = await Promise.all([
      supabase.from('jungle_lines').select('*').eq('game_id', gameId),
      supabase.from('jungle_picks').select('*').eq('game_id', gameId),
      supabase.from('jungle_results').select('*').eq('game_id', gameId),
    ])

    if (!lines || !picks || !resultsData) {
      alert('Missing data to calculate scores')
      setSavingResults(false)
      return
    }

    const scores = calculateScores(picks as Pick[], lines as Line[], resultsData as Result[])
    const scoresToInsert = Array.from(scores.entries()).map(([playerName, score]) => ({
      game_id: gameId,
      player: playerName,
      correct_picks: score.correctPicks,
      missed_picks: score.missedPicks,
      total_points: score.totalPoints,
    }))

    await supabase.from('jungle_scores').delete().eq('game_id', gameId)
    if (scoresToInsert.length > 0) await supabase.from('jungle_scores').insert(scoresToInsert)

    setCalculated(true)
    setSavingResults(false)
    alert('Scores calculated!')
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  if (currentUser !== 'joshua') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-2">Admin access restricted to Joshua.</p>
        <a href="/" className="text-emerald-400 hover:underline text-sm">Go home</a>
      </div>
    )
  }

  const currentGame = games.find(g => g.game_number === selectedGame)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Admin Panel</h1>
        <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">Joshua only</span>
      </div>

      <div className="week-selector">
        {GAMES.map(g => {
          const gameData = games.find(gd => gd.game_number === g.number)
          return (
            <button key={g.number} onClick={() => setSelectedGame(g.number)}
              className={`week-btn ${selectedGame === g.number ? 'active' : ''}`}>
              {g.label}
              {gameData?.forfeited && <span className="ml-1 text-red-400 text-xs">✕</span>}
            </button>
          )
        })}
      </div>

      {currentGame && (
        <>
          {/* ── Forfeit ── */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-200">
                  {GAMES.find(g => g.number === selectedGame)?.label} — Forfeit
                </h2>
                <p className="text-slate-500 text-sm mt-1">Marks game forfeited. Zeros all scores.</p>
              </div>
              <button onClick={() => toggleForfeit(currentGame)} disabled={saving}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  currentGame.forfeited
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                    : 'btn-secondary hover:border-red-500/30 hover:text-red-400'
                }`}>
                {currentGame.forfeited ? 'Forfeited ✕' : 'Mark Forfeited'}
              </button>
            </div>
          </div>

          {/* ── Player Availability ── */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-semibold text-slate-200 mb-1">Player Availability</h2>
            <p className="text-slate-500 text-sm mb-5">Toggle players inactive if they're sitting out this week.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {PLAYERS.map(player => {
                const entry = availability[currentGame.id]?.[player] ?? { active: true, reason: 'OUT' }
                const isActive = entry.active
                return (
                  <div key={player} className="flex flex-col gap-1">
                    <button onClick={() => togglePlayerAvailability(currentGame.id, player)}
                      className={`px-3 py-3 rounded-xl text-sm font-medium capitalize transition-all w-full ${
                        isActive
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}>
                      <div>{player}</div>
                      <div className="text-xs mt-0.5 font-normal">{isActive ? 'Active' : entry.reason || 'OUT'}</div>
                    </button>
                    {/* Reason input — only shown when inactive */}
                    {!isActive && (
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="OUT"
                        value={entry.reason}
                        onChange={(e) => updateAvailabilityReason(currentGame.id, player, e.target.value.toUpperCase())}
                        className="glass-input rounded-lg px-2 py-1 text-xs text-center uppercase w-full"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Stat Results ── */}
          <div className="glass-card rounded-2xl p-4 md:p-6">
            <h2 className="font-semibold text-slate-200 mb-1">Stat Results</h2>
            <p className="text-slate-500 text-sm mb-4">
              Enter post-game stats. AB (at-bats) tracked for batting average only — not scored.
              {isForfeited && <span className="ml-2 text-red-400">(Game forfeited)</span>}
              {calculated && <span className="ml-2 text-green-400">✓ Scores calculated</span>}
            </p>

            {resultsLoading ? (
              <div className="text-slate-500 text-sm py-4 text-center">Loading results...</div>
            ) : (
              <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      {STATS.map(stat => <th key={stat} className="text-center">{STAT_LABELS[stat]}</th>)}
                      <th className="text-center" style={{ color: 'var(--amber-warm)', opacity: 0.7 }}>AB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortWithInactiveAtBottom(PLAYERS, inactivePlayers).map(targetPlayer => {
                      const isInactive = inactivePlayers.has(targetPlayer)
                      return (
                        <tr key={targetPlayer} className={isInactive ? 'player-inactive' : ''}>
                          <td className="capitalize font-medium">
                            <span>{targetPlayer}</span>
                            {isInactive && <span className="badge badge-out ml-2">{inactivePlayers.get(targetPlayer) || 'OUT'}</span>}
                          </td>
                          {STATS.map(stat => (
                            <td key={stat} className="text-center">
                              {isInactive ? <span className="text-slate-700">—</span> : (
                                <input type="number" min="0" placeholder="—"
                                  value={results[targetPlayer]?.[stat] ?? ''}
                                  onChange={(e) => handleResultChange(targetPlayer, stat, e.target.value)}
                                  className="w-12 md:w-14 px-1 md:px-2 py-2 glass-input rounded-lg text-center text-sm"
                                />
                              )}
                            </td>
                          ))}
                          <td className="text-center">
                            {isInactive ? <span className="text-slate-700">—</span> : (
                              <input type="number" min="0" placeholder="—"
                                value={results[targetPlayer]?.['ab'] ?? ''}
                                onChange={(e) => handleResultChange(targetPlayer, 'ab', e.target.value)}
                                className="w-12 md:w-14 px-1 md:px-2 py-2 glass-input rounded-lg text-center text-sm"
                                style={{ borderColor: 'rgba(245,158,11,0.2)' }}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Prop Results */}
            <div className="mt-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Prop Results</h3>
              {PROP_BETS.map(prop => (
                <div key={prop}>
                  <p className="text-sm text-slate-300 mb-3 font-medium">{PROP_BET_LABELS[prop]}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {PLAYERS.filter(p => !inactivePlayers.has(p)).map(p => (
                      <button key={p}
                        onClick={() => setPropResults(prev => {
                          const current = prev[prop] || []
                          const updated = current.includes(p) ? current.filter(w => w !== p) : [...current, p]
                          return { ...prev, [prop]: updated }
                        })}
                        className={`px-2 py-2.5 rounded-lg text-xs capitalize font-medium transition-all ${
                          propResults[prop]?.includes(p)
                            ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                            : 'btn-secondary'
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Save + Calculate buttons */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => handleSubmitResults(currentGame.id)} disabled={savingResults}
                className="flex-1 btn-secondary py-3 rounded-xl text-sm font-medium disabled:opacity-50">
                {savingResults ? 'Saving...' : 'Save Results'}
              </button>
              <button onClick={() => handleCalculateScores(currentGame.id)} disabled={savingResults}
                className="flex-1 btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                {savingResults ? 'Working...' : calculated ? 'Recalculate Scores' : 'Calculate Scores'}
              </button>
            </div>
          </div>

          {/* ── Team MVP + Highlight ── */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-semibold text-slate-200 mb-1">
              {GAMES.find(g => g.number === selectedGame)?.label} — Highlight
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Set the Team MVP and a game recap. Shown on the Stats page.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>Team MVP</label>
                <select value={highlights[currentGame.id]?.mvp_player || ''}
                  onChange={(e) => updateHighlight(currentGame.id, 'mvp_player', e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2.5 text-sm capitalize">
                  <option value="">— No MVP —</option>
                  {PLAYERS.map(p => (
                    <option key={p} value={p} className="bg-gray-900 capitalize">{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>Game Recap / Blurb</label>
                <textarea value={highlights[currentGame.id]?.mvp_blurb || ''}
                  onChange={(e) => updateHighlight(currentGame.id, 'mvp_blurb', e.target.value)}
                  placeholder="Write a quick recap of the game highlights..."
                  rows={3} className="w-full glass-input rounded-xl px-3 py-2.5 text-sm resize-none" />
              </div>
              <button onClick={() => saveHighlight(currentGame.id)} disabled={savingHighlight}
                className="btn-accent px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {savingHighlight ? 'Saving...' : 'Save Highlight'}
              </button>
            </div>
          </div>

          <p className="text-slate-600 text-xs text-center">
            Availability toggles save instantly. Refresh other pages to see updates.
          </p>
        </>
      )}
    </div>
  )
}
