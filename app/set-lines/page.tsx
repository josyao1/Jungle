'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, getGamePhase, Player, Stat, isPlayerInjured } from '@/lib/constants'
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

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {}
    PLAYERS.forEach(p => {
      initial[p] = {}
      STATS.forEach(s => {
        initial[p][s] = ''
      })
    })
    setPredictions(initial)
  }, [])

  const loadData = useCallback(async () => {
    const savedPlayer = localStorage.getItem('jungle_player') as Player | null
    if (!savedPlayer) {
      setLoading(false)
      return
    }
    setPlayer(savedPlayer)

    const now = new Date()
    const currentGame = GAMES.find(g => {
      const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
      return now < gameEnd
    }) || GAMES[GAMES.length - 1]

    const currentPhase = getGamePhase(currentGame)
    setPhase(currentPhase)

    let { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('game_number', currentGame.number)
      .single()

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

    const { data: existingPredictions } = await supabase
      .from('line_predictions')
      .select('*')
      .eq('game_id', games.id)

    if (existingPredictions) {
      const playerPredictions = existingPredictions.filter(p => p.submitter === savedPlayer)
      if (playerPredictions.length > 0) {
        setSubmitted(true)
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
        [stat]: value,
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

  const isLocked = phase === 'locked'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Set Lines</h1>
        <PlayerSelect onSelect={setPlayer} selected={player} compact />
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLocked && (
        <div className="glass-card rounded-xl p-4 border-yellow-500/30">
          <p className="text-yellow-400 text-sm">Lines are locked. View only.</p>
        </div>
      )}

      {submitted && !isLocked && (
        <div className="glass-card rounded-xl p-4 border-green-500/30">
          <p className="text-green-400 text-sm">Predictions submitted! You can update until lock.</p>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr className="bg-white/[0.02]">
                <th>Player</th>
                {STATS.map(stat => (
                  <th key={stat} className="text-center">{STAT_LABELS[stat]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAYERS.map(targetPlayer => {
                const injured = isPlayerInjured(targetPlayer)
                return (
                  <tr key={targetPlayer} className={injured ? 'player-injured' : ''}>
                    <td className="capitalize font-medium">
                      {targetPlayer}
                      {injured && <span className="badge badge-ir ml-2">IR</span>}
                    </td>
                    {STATS.map(stat => (
                      <td key={stat} className="text-center">
                        {injured ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="-"
                            value={predictions[targetPlayer]?.[stat] ?? ''}
                            onChange={(e) => handleChange(targetPlayer, stat, e.target.value)}
                            disabled={isLocked}
                            className="w-16 px-2 py-2 glass-input rounded-lg text-center disabled:opacity-50"
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
            className="btn-secondary px-6 py-3 rounded-xl text-sm font-medium"
          >
            Clear All
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : submitted ? 'Update Predictions' : 'Submit Predictions'}
          </button>
        </div>
      )}
    </div>
  )
}
