'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, getGamePhase, Player, Stat } from '@/lib/constants'
import { supabase, LinePrediction } from '@/lib/supabase'

export default function SetLinesPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Record<string, Record<string, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [otherPredictions, setOtherPredictions] = useState<LinePrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<string>('lines_open')

  // Initialize predictions with empty values (blank = no prediction)
  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      initial[p] = {}
      STATS.forEach(s => {
        initial[p][s] = '' // blank by default
      })
    })
    setPredictions(initial)
  }, [])

  const loadData = useCallback(async () => {
    // Get player from localStorage
    const savedPlayer = localStorage.getItem('jungle_player') as Player | null
    if (!savedPlayer) {
      setLoading(false)
      return
    }
    setPlayer(savedPlayer)

    // Find current game
    const now = new Date()
    const currentGame = GAMES.find(g => {
      const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
      return now < gameEnd
    }) || GAMES[GAMES.length - 1]

    setPhase(getGamePhase(currentGame))

    // Get game ID from database
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

    // Load existing predictions
    const { data: existingPredictions } = await supabase
      .from('line_predictions')
      .select('*')
      .eq('game_id', games.id)

    if (existingPredictions) {
      // Check if current player has submitted
      const playerPredictions = existingPredictions.filter(p => p.submitter === savedPlayer)
      if (playerPredictions.length > 0) {
        setSubmitted(true)
        // Load player's predictions
        const loaded: Record<string, Record<string, string>> = {}
        PLAYERS.forEach(p => {
          loaded[p] = {}
          STATS.forEach(s => {
            const pred = playerPredictions.find(pr => pr.player === p && pr.stat === s)
            loaded[p][s] = pred ? String(pred.value) : ''
          })
        })
        setPredictions(loaded)
        // Show others' predictions
        setOtherPredictions(existingPredictions.filter(p => p.submitter !== savedPlayer))
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleChange = (targetPlayer: string, stat: string, value: string) => {
    setPredictions(prev => ({
      ...prev,
      [targetPlayer]: {
        ...prev[targetPlayer],
        [stat]: value, // keep as string, empty = no prediction
      },
    }))
  }

  const handleSubmit = async () => {
    if (!player || !gameId) return
    setSaving(true)

    // Build predictions array - only include non-blank values
    const toInsert: Array<{
      game_id: string
      submitter: string
      player: string
      stat: string
      value: number
    }> = []

    PLAYERS.forEach(p => {
      STATS.forEach(s => {
        const val = predictions[p]?.[s]
        if (val !== '' && val !== undefined) {
          toInsert.push({
            game_id: gameId,
            submitter: player,
            player: p,
            stat: s,
            value: parseFloat(val),
          })
        }
      })
    })

    // First delete any existing predictions for this user/game (in case they cleared some)
    await supabase
      .from('line_predictions')
      .delete()
      .eq('game_id', gameId)
      .eq('submitter', player)

    // Then insert the new ones
    const { error } = toInsert.length > 0
      ? await supabase.from('line_predictions').insert(toInsert)
      : { error: null }

    if (!error) {
      setSubmitted(true)
      // Reload to show others' predictions
      loadData()
    }

    setSaving(false)
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

  const isLocked = phase !== 'lines_open'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Set Lines</h1>
        <span className="text-gray-400 capitalize">Playing as: {player}</span>
      </div>

      {isLocked && (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-400">Lines are locked. You can view but not edit.</p>
        </div>
      )}

      {submitted && !isLocked && (
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-4">
          <p className="text-green-400">Your predictions are submitted! You can update until lines lock.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-4 py-3 text-left">Player</th>
              {STATS.map(stat => (
                <th key={stat} className="px-4 py-3 text-center text-sm">
                  {STAT_LABELS[stat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAYERS.map(targetPlayer => (
              <tr key={targetPlayer} className="border-t border-gray-700">
                <td className="px-4 py-3 capitalize font-medium">{targetPlayer}</td>
                {STATS.map(stat => (
                  <td key={stat} className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="-"
                      value={predictions[targetPlayer]?.[stat] ?? ''}
                      onChange={(e) => handleChange(targetPlayer, stat, e.target.value)}
                      disabled={isLocked}
                      className="w-16 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center disabled:opacity-50 placeholder-gray-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLocked && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              const cleared: Record<string, Record<string, string>> = {}
              PLAYERS.forEach(p => {
                cleared[p] = {}
                STATS.forEach(s => {
                  cleared[p][s] = ''
                })
              })
              setPredictions(cleared)
            }}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : submitted ? 'Update Predictions' : 'Submit Predictions'}
          </button>
        </div>
      )}

      {submitted && otherPredictions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Others&apos; Predictions</h2>
          {PLAYERS.filter(p => p !== player).map(submitter => {
            const theirPredictions = otherPredictions.filter(p => p.submitter === submitter)
            if (theirPredictions.length === 0) return null

            return (
              <div key={submitter} className="bg-gray-800 rounded-lg p-4">
                <h3 className="capitalize font-medium mb-2">{submitter}</h3>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {PLAYERS.map(targetPlayer => (
                    <div key={targetPlayer} className="space-y-1">
                      <div className="capitalize text-gray-400">{targetPlayer}</div>
                      {STATS.map(stat => {
                        const pred = theirPredictions.find(
                          p => p.player === targetPlayer && p.stat === stat
                        )
                        return (
                          <div key={stat} className="text-xs">
                            {STAT_LABELS[stat as Stat].slice(0, 3)}: {pred?.value || '-'}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
