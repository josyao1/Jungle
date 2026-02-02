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
  const [propResults, setPropResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculated, setCalculated] = useState(false)

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      initial[p] = {}
      STATS.forEach(s => {
        initial[p][s] = '' // empty = not counted/skipped
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

    // Load existing results
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

    // Load existing prop results
    const { data: existingPropResults } = await supabase
      .from('prop_results')
      .select('*')
      .eq('game_id', games.id)

    if (existingPropResults) {
      const loaded: Record<string, string> = {}
      existingPropResults.forEach(p => {
        loaded[p.prop_type] = p.winner
      })
      setPropResults(loaded)
    }

    // Check if scores already calculated
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
        [stat]: value, // empty = skipped/not counted
      },
    }))
  }

  const handlePropResult = (propType: string, winner: string) => {
    setPropResults(prev => ({
      ...prev,
      [propType]: winner,
    }))
  }

  const handleSubmit = async () => {
    if (!gameId) return
    setSaving(true)

    // Delete existing results for this game first (in case some were cleared)
    await supabase
      .from('results')
      .delete()
      .eq('game_id', gameId)

    // Save stat results - only non-empty values
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
      await supabase
        .from('results')
        .insert(resultsToInsert)
    }

    // Save prop results
    const propResultsToInsert = Object.entries(propResults)
      .filter(([, winner]) => winner)
      .map(([propType, winner]) => ({
        game_id: gameId,
        prop_type: propType,
        winner: winner,
      }))

    if (propResultsToInsert.length > 0) {
      await supabase
        .from('prop_results')
        .upsert(propResultsToInsert, { onConflict: 'game_id,prop_type' })
    }

    setSaving(false)
    alert('Results saved!')
  }

  const handleCalculateScores = async () => {
    if (!gameId) return
    setSaving(true)

    // Fetch all data needed for score calculation
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

    // Build prop results object
    const propResultsObj: Record<string, string> = {}
    propResultsData?.forEach(p => {
      propResultsObj[p.prop_type] = p.winner
    })

    // Calculate scores
    const scores = calculateScores(
      picks as Pick[],
      lines as Line[],
      resultsData as Result[],
      predictions,
      propPicksData as PropPick[] || [],
      propResultsObj
    )

    // Save scores
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

    await supabase
      .from('scores')
      .upsert(scoresToInsert, { onConflict: 'game_id,player' })

    setCalculated(true)
    setSaving(false)
    alert('Scores calculated and saved!')
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!player) {
    return (
      <div className="text-center py-8">
        <p className="mb-4">Please select your name first</p>
        <a href="/" className="text-green-400 hover:underline">Go to home</a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Enter Results - Game {gameNumber}</h1>
        <PlayerSelect
          onSelect={setPlayer}
          selected={player}
          compact
        />
      </div>

      {calculated && (
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-4">
          <p className="text-green-400">Scores have been calculated! Check the leaderboard.</p>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Stat Results</h2>
        <p className="text-gray-400 text-sm mb-3">Leave blank if we forgot to track (won&apos;t count for/against anyone)</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-2 py-2 text-left">Player</th>
                {STATS.map(stat => (
                  <th key={stat} className="px-2 py-2 text-center text-xs">
                    {STAT_LABELS[stat]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAYERS.map(targetPlayer => (
                <tr key={targetPlayer} className="border-b border-gray-700/50">
                  <td className="px-2 py-2 capitalize font-medium">{targetPlayer}</td>
                  {STATS.map(stat => (
                    <td key={stat} className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="—"
                        value={results[targetPlayer]?.[stat] ?? ''}
                        onChange={(e) => handleChange(targetPlayer, stat, e.target.value)}
                        className="w-14 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center placeholder-gray-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Prop Results</h2>

        <div className="space-y-4">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm font-medium mb-2">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-6 gap-2">
                {PLAYERS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePropResult(prop, p)}
                    className={`px-2 py-2 rounded text-xs capitalize transition-colors ${
                      propResults[prop] === p
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
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
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Results'}
        </button>
        <button
          onClick={handleCalculateScores}
          disabled={saving}
          className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Calculating...' : 'Calculate Scores'}
        </button>
      </div>
    </div>
  )
}
