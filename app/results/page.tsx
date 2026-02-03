'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, PROP_BETS, PROP_BET_LABELS, GAMES, Player, Stat } from '@/lib/constants'
import PlayerSelect from '@/components/PlayerSelect'
import { supabase, Result, Line, Pick, PropPick } from '@/lib/supabase'
import { calculateScores } from '@/lib/utils'

export default function ResultsPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameNumber, setGameNumber] = useState<number>(1)
  const [results, setResults] = useState<Record<string, Record<string, string>>>({})
  const [propResults, setPropResults] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculated, setCalculated] = useState(false)

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      initial[p] = {}
      STATS.forEach(s => {
        initial[p][s] = ''
      })
    })
    setResults(initial)
  }, [])

  const loadData = useCallback(async () => {
    const savedPlayer = localStorage.getItem('jungle_player') as Player | null
    setPlayer(savedPlayer)

    const now = new Date()
    const currentGame = GAMES.find(g => {
      const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
      return now < gameEnd
    }) || GAMES[GAMES.length - 1]

    setGameNumber(currentGame.number)

    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('game_number', currentGame.number)
      .single()

    if (!games) {
      setLoading(false)
      return
    }
    setGameId(games.id)

    const { data: existingResults } = await supabase
      .from('results')
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
      .from('prop_results')
      .select('*')
      .eq('game_id', games.id)

    if (existingPropResults) {
      const loaded: Record<string, string[]> = {}
      existingPropResults.forEach(p => {
        loaded[p.prop_type] = p.winner.split(',').map((w: string) => w.trim())
      })
      setPropResults(loaded)
    }

    const { data: scores } = await supabase
      .from('scores')
      .select('id')
      .eq('game_id', games.id)
      .limit(1)

    setCalculated(!!(scores && scores.length > 0))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleChange = (targetPlayer: string, stat: string, value: string) => {
    setResults(prev => ({
      ...prev,
      [targetPlayer]: {
        ...prev[targetPlayer],
        [stat]: value,
      },
    }))
  }

  const handlePropResult = (propType: string, winner: string) => {
    setPropResults(prev => {
      const current = prev[propType] || []
      const updated = current.includes(winner)
        ? current.filter(w => w !== winner)
        : [...current, winner]
      return { ...prev, [propType]: updated }
    })
  }

  const handleSubmit = async () => {
    if (!gameId) return
    setSaving(true)

    await supabase.from('results').delete().eq('game_id', gameId)

    const resultsToInsert: Array<{
      game_id: string
      player: string
      stat: string
      value: number
    }> = []

    PLAYERS.forEach(p => {
      STATS.forEach(s => {
        const val = results[p]?.[s]
        if (val !== '' && val !== undefined) {
          resultsToInsert.push({
            game_id: gameId,
            player: p,
            stat: s,
            value: parseInt(val),
          })
        }
      })
    })

    if (resultsToInsert.length > 0) {
      await supabase.from('results').insert(resultsToInsert)
    }

    const propResultsToInsert = Object.entries(propResults)
      .filter(([, winners]) => winners && winners.length > 0)
      .map(([propType, winners]) => ({
        game_id: gameId,
        prop_type: propType,
        winner: winners.join(','),
      }))

    if (propResultsToInsert.length > 0) {
      await supabase.from('prop_results').upsert(propResultsToInsert, { onConflict: 'game_id,prop_type' })
    }

    setSaving(false)
    alert('Results saved!')
  }

  const handleCalculateScores = async () => {
    if (!gameId) return
    setSaving(true)

    const [
      { data: lines },
      { data: picks },
      { data: resultsData },
      { data: predictions },
      { data: propPicksData },
      { data: propResultsData },
    ] = await Promise.all([
      supabase.from('lines').select('*').eq('game_id', gameId),
      supabase.from('picks').select('*').eq('game_id', gameId),
      supabase.from('results').select('*').eq('game_id', gameId),
      supabase.from('line_predictions').select('*').eq('game_id', gameId),
      supabase.from('prop_picks').select('*').eq('game_id', gameId),
      supabase.from('prop_results').select('*').eq('game_id', gameId),
    ])

    if (!lines || !picks || !resultsData || !predictions) {
      alert('Missing data to calculate scores')
      setSaving(false)
      return
    }

    const propResultsObj: Record<string, string> = {}
    propResultsData?.forEach(p => {
      propResultsObj[p.prop_type] = p.winner
    })

    const scores = calculateScores(
      picks as Pick[],
      lines as Line[],
      resultsData as Result[],
      predictions,
      propPicksData as PropPick[] || [],
      propResultsObj
    )

    const scoresToInsert = Array.from(scores.entries()).map(([playerName, score]) => ({
      game_id: gameId,
      player: playerName,
      correct_picks: score.correctPicks,
      missed_picks: score.missedPicks,
      exact_lines: score.exactLines,
      prop_wins: score.propWins,
      prop_misses: score.propMisses,
      total_points: score.totalPoints,
    }))

    await supabase.from('scores').delete().eq('game_id', gameId)

    if (scoresToInsert.length > 0) {
      await supabase.from('scores').insert(scoresToInsert)
    }

    setCalculated(true)
    setSaving(false)
    alert('Scores recalculated!')
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading...</div>
  }

  if (!player) {
    return (
      <div className="text-center py-8">
        <p className="mb-4 text-slate-500">Select your name first</p>
        <a href="/" className="text-court-accent hover:underline">Go to home</a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Enter Results - Game {gameNumber}</h1>
        <PlayerSelect onSelect={setPlayer} selected={player} compact />
      </div>

      {calculated && (
        <div className="glass-card rounded-xl p-4 border-green-500/30">
          <p className="text-green-400 text-sm">Scores calculated! Check the leaderboard.</p>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Stat Results</h2>
        <p className="text-slate-500 text-sm mb-4">Leave blank if not tracked</p>

        <div className="overflow-x-auto">
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
              {PLAYERS.map(targetPlayer => (
                <tr key={targetPlayer}>
                  <td className="capitalize font-medium">{targetPlayer}</td>
                  {STATS.map(stat => (
                    <td key={stat} className="text-center">
                      <input
                        type="number"
                        min="0"
                        placeholder="—"
                        value={results[targetPlayer]?.[stat] ?? ''}
                        onChange={(e) => handleChange(targetPlayer, stat, e.target.value)}
                        className="w-14 px-2 py-2 glass-input rounded-lg text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Prop Results</h2>
        <p className="text-slate-500 text-sm mb-4">Select multiple for ties</p>

        <div className="space-y-6">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm text-slate-300 mb-3">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-6 gap-2">
                {PLAYERS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePropResult(prop, p)}
                    className={`px-2 py-3 rounded-lg text-xs capitalize font-medium transition-all ${
                      propResults[prop]?.includes(p)
                        ? 'bg-court-accent/20 border-2 border-court-accent text-court-accent'
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
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 btn-secondary py-3 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Results'}
        </button>
        <button
          onClick={handleCalculateScores}
          disabled={saving}
          className="flex-1 btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Calculating...' : calculated ? 'Recalculate Scores' : 'Calculate Scores'}
        </button>
      </div>
    </div>
  )
}
