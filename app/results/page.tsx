'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, PROP_BETS, PROP_BET_LABELS, sortWithInactiveAtBottom, Player } from '@/lib/constants'
import PlayerSelect from '@/components/PlayerSelect'
import { supabase, Result, Line, Pick, getInactivePlayersForGame } from '@/lib/supabase'
import { calculateScores } from '@/lib/utils'

export default function ResultsPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameNumber, setGameNumber] = useState<number>(1)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [results, setResults] = useState<Record<string, Record<string, string>>>({})
  const [inactivePlayers, setInactivePlayers] = useState<Set<string>>(new Set())
  const [propResults, setPropResults] = useState<Record<string, string[]>>({})
  const [isForfeited, setIsForfeited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculated, setCalculated] = useState(false)

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      initial[p] = {}
      STATS.forEach(s => { initial[p][s] = '' })
    })
    setResults(initial)
  }, [])

  const loadData = useCallback(async (weekNum?: number) => {
    const savedPlayer = localStorage.getItem('jungle_player') as Player | null
    setPlayer(savedPlayer)

    const now = new Date()
    const currentGame = GAMES.find(g => {
      const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
      return now < gameEnd
    }) || GAMES[GAMES.length - 1]

    const gameToLoad = weekNum ? GAMES.find(g => g.number === weekNum) || currentGame : currentGame
    if (!weekNum) setSelectedWeek(currentGame.number)
    setGameNumber(gameToLoad.number)

    const { data: games } = await supabase
      .from('jungle_games')
      .select('id, forfeited')
      .eq('game_number', gameToLoad.number)
      .single()

    if (!games) { setLoading(false); return }
    setGameId(games.id)
    setIsForfeited(games.forfeited || false)

    const inactive = await getInactivePlayersForGame(games.id)
    setInactivePlayers(inactive)

    const { data: existingResults } = await supabase
      .from('jungle_results')
      .select('*')
      .eq('game_id', games.id)

    if (existingResults && existingResults.length > 0) {
      const loaded: Record<string, Record<string, string>> = {}
      PLAYERS.forEach(p => {
        loaded[p] = {}
        STATS.forEach(s => {
          const result = existingResults.find(r => r.player === p && r.stat === s)
          loaded[p][s] = result ? String(result.value) : ''
        })
      })
      setResults(loaded)
    }

    const { data: existingPropResults } = await supabase
      .from('jungle_prop_results')
      .select('*')
      .eq('game_id', games.id)
    if (existingPropResults) {
      const loaded: Record<string, string[]> = {}
      existingPropResults.forEach((p: any) => {
        loaded[p.prop_type] = p.winner.split(',').map((w: string) => w.trim())
      })
      setPropResults(loaded)
    }

    const { data: scores } = await supabase
      .from('jungle_scores')
      .select('id')
      .eq('game_id', games.id)
      .limit(1)

    setCalculated(!!(scores && scores.length > 0))
    setLoading(false)
  }, [])

  const handleWeekChange = (weekNum: number) => {
    setSelectedWeek(weekNum)
    setGameNumber(weekNum)
    setLoading(true)
    loadData(weekNum)
  }

  useEffect(() => { loadData() }, [loadData])

  const handleChange = (targetPlayer: string, stat: string, value: string) => {
    setResults(prev => ({
      ...prev,
      [targetPlayer]: { ...prev[targetPlayer], [stat]: value },
    }))
  }

  const handleSubmit = async () => {
    if (!gameId) return
    setSaving(true)

    await supabase.from('jungle_results').delete().eq('game_id', gameId)

    const resultsToInsert: Array<{ game_id: string; player: string; stat: string; value: number }> = []

    PLAYERS.forEach(p => {
      if (inactivePlayers.has(p)) return
      STATS.forEach(s => {
        const val = results[p]?.[s]
        if (val !== '' && val !== undefined) {
          resultsToInsert.push({ game_id: gameId, player: p, stat: s, value: parseInt(val) })
        }
      })
    })

    if (resultsToInsert.length > 0) {
      await supabase.from('jungle_results').insert(resultsToInsert)
    }

    // Save prop results
    const propResultsToInsert = Object.entries(propResults)
      .filter(([, winners]) => winners && winners.length > 0)
      .map(([propType, winners]) => ({ game_id: gameId, prop_type: propType, winner: winners.join(',') }))
    if (propResultsToInsert.length > 0) {
      await supabase.from('jungle_prop_results').upsert(propResultsToInsert, { onConflict: 'game_id,prop_type' })
    }

    setSaving(false)
    alert('Results saved!')
  }

  const handleCalculateScores = async () => {
    if (!gameId) return
    setSaving(true)

    // If forfeited, zero out all scores
    if (isForfeited) {
      await supabase.from('jungle_scores').delete().eq('game_id', gameId)
      const zeroScores = PLAYERS.map(p => ({
        game_id: gameId,
        player: p,
        correct_picks: 0,
        missed_picks: 0,
        total_points: 0,
      }))
      await supabase.from('jungle_scores').insert(zeroScores)
      setCalculated(true)
      setSaving(false)
      alert('Game forfeited — all scores set to 0.')
      return
    }

    const [
      { data: lines },
      { data: picks },
      { data: resultsData },
    ] = await Promise.all([
      supabase.from('jungle_lines').select('*').eq('game_id', gameId),
      supabase.from('jungle_picks').select('*').eq('game_id', gameId),
      supabase.from('jungle_results').select('*').eq('game_id', gameId),
    ])

    if (!lines || !picks || !resultsData) {
      alert('Missing data to calculate scores')
      setSaving(false)
      return
    }

    const scores = calculateScores(
      picks as Pick[],
      lines as Line[],
      resultsData as Result[],
    )

    const scoresToInsert = Array.from(scores.entries()).map(([playerName, score]) => ({
      game_id: gameId,
      player: playerName,
      correct_picks: score.correctPicks,
      missed_picks: score.missedPicks,
      total_points: score.totalPoints,
    }))

    await supabase.from('jungle_scores').delete().eq('game_id', gameId)
    if (scoresToInsert.length > 0) {
      await supabase.from('jungle_scores').insert(scoresToInsert)
    }

    setCalculated(true)
    setSaving(false)
    alert('Scores recalculated!')
  }

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  if (!player) {
    return (
      <div className="text-center py-12">
        <p className="mb-4 text-slate-500">Select your name first</p>
        <a href="/" className="text-emerald-400 hover:underline">Go to home</a>
      </div>
    )
  }

  const now = new Date()
  const currentGameNum = (GAMES.find(g => {
    const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
    return now < gameEnd
  }) || GAMES[GAMES.length - 1]).number

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">
          Enter Results — {GAMES.find(g => g.number === gameNumber)?.label || `Game ${gameNumber}`}
          {isForfeited && <span className="ml-2 text-sm text-red-400 font-normal">(Forfeited)</span>}
        </h1>
        <PlayerSelect onSelect={setPlayer} selected={player} compact />
      </div>

      <div className="week-selector">
        {GAMES.map(g => (
          <button
            key={g.number}
            onClick={() => handleWeekChange(g.number)}
            className={`week-btn ${selectedWeek === g.number ? 'active' : ''}`}
          >
            {g.label}
            {g.number === currentGameNum && <span className="ml-1 text-xs opacity-75">(Current)</span>}
          </button>
        ))}
      </div>

      {isForfeited && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30">
          <p className="text-red-400 text-sm">
            This game is marked as forfeited. Calculating scores will zero out all picks for this week.
          </p>
        </div>
      )}

      {calculated && (
        <div className="glass-card rounded-xl p-4 border border-green-500/30">
          <p className="text-green-400 text-sm">Scores calculated! Check the leaderboard.</p>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">Stat Results</h2>
        <p className="text-slate-500 text-sm mb-4">Leave blank if not tracked</p>

        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Player</th>
                {STATS.map(stat => (
                  <th key={stat} className="text-center">{STAT_LABELS[stat]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortWithInactiveAtBottom(PLAYERS, inactivePlayers).map(targetPlayer => {
                const isInactive = inactivePlayers.has(targetPlayer)
                return (
                  <tr key={targetPlayer} className={isInactive ? 'player-inactive' : ''}>
                    <td className="capitalize font-medium">
                      <span>{targetPlayer}</span>
                      {isInactive && <span className="badge badge-out ml-2">OUT</span>}
                    </td>
                    {STATS.map(stat => (
                      <td key={stat} className="text-center">
                        {isInactive ? (
                          <span className="text-slate-700">—</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={results[targetPlayer]?.[stat] ?? ''}
                            onChange={(e) => handleChange(targetPlayer, stat, e.target.value)}
                            className="w-12 md:w-14 px-1 md:px-2 py-2 glass-input rounded-lg text-center text-sm"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prop Results */}
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">Prop Results</h2>
        <p className="text-slate-500 text-sm mb-4">Select multiple for ties</p>
        <div className="space-y-6">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm text-slate-300 mb-3 font-medium">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-3 gap-2">
                {PLAYERS.filter(p => !inactivePlayers.has(p)).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setPropResults(prev => {
                        const current = prev[prop] || []
                        const updated = current.includes(p)
                          ? current.filter(w => w !== p)
                          : [...current, p]
                        return { ...prev, [prop]: updated }
                      })
                    }}
                    className={`px-2 py-3 rounded-lg text-xs capitalize font-medium transition-all ${
                      propResults[prop]?.includes(p)
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                        : 'btn-secondary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 btn-secondary py-3 rounded-xl text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Results'}
        </button>
        <button onClick={handleCalculateScores} disabled={saving}
          className="flex-1 btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Calculating...' : calculated ? 'Recalculate Scores' : 'Calculate Scores'}
        </button>
      </div>
    </div>
  )
}
