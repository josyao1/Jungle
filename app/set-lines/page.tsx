'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, getGamePhase, Player, Stat } from '@/lib/constants'
import PlayerSelect from '@/components/PlayerSelect'
import { supabase } from '@/lib/supabase'

export default function SetLinesPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Record<string, Record<string, string>>>({})
  const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<string>('open')
  const [error, setError] = useState<string | null>(null)

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

    const currentPhase = getGamePhase(currentGame)
    setPhase(currentPhase)

    // Get game ID from database
    let { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('game_number', currentGame.number)
      .single()

    // If game doesn't exist, create it
    if (!games) {
      const { data: newGame, error: createError } = await supabase
        .from('games')
        .insert({
          game_number: currentGame.number,
          game_date: currentGame.date.toISOString(),
          lines_lock_time: currentGame.lockTime.toISOString(),
          picks_lock_time: currentGame.lockTime.toISOString(),
          status: 'upcoming'
        })
        .select('id')
        .single()

      if (createError || !newGame) {
        setError(`Could not find or create game ${currentGame.number}`)
        setLoading(false)
        return
      }
      games = newGame
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
    if (!player || !gameId) {
      setError('Missing player or game ID. Try refreshing.')
      return
    }
    setSaving(true)
    setError(null)

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
    const { error: deleteError } = await supabase
      .from('line_predictions')
      .delete()
      .eq('game_id', gameId)
      .eq('submitter', player)

    if (deleteError) {
      setError(`Delete failed: ${deleteError.message}`)
      setSaving(false)
      return
    }

    // Then insert the new ones
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('line_predictions').insert(toInsert)
      if (insertError) {
        setError(`Insert failed: ${insertError.message}`)
        setSaving(false)
        return
      }
    }

    setSubmitted(true)
    loadData()
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

  const isLocked = phase === 'locked'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Set Lines</h1>
        <PlayerSelect
          onSelect={setPlayer}
          selected={player}
          compact
        />
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

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

          </div>
  )
}
