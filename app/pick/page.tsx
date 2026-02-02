'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, PROP_BETS, PROP_BET_LABELS, GAMES, getGamePhase, Player, Stat, PropBet } from '@/lib/constants'
import { supabase, Line, Pick, PropPick } from '@/lib/supabase'
import { calculateAveragedLine } from '@/lib/utils'

export default function PickPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [picks, setPicks] = useState<Record<string, Record<string, boolean>>>({})
  const [propPicks, setPropPicks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<string>('lines_open')

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

    setPhase(getGamePhase(currentGame))

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

    // Try to load averaged lines first
    let { data: existingLines } = await supabase
      .from('lines')
      .select('*')
      .eq('game_id', games.id)

    // If no averaged lines exist and we're in picks phase, calculate them
    if ((!existingLines || existingLines.length === 0) && getGamePhase(currentGame) !== 'lines_open') {
      await calculateAndSaveLines(games.id)
      const { data: newLines } = await supabase
        .from('lines')
        .select('*')
        .eq('game_id', games.id)
      existingLines = newLines
    }

    setLines(existingLines || [])

    // Load existing picks
    const { data: existingPicks } = await supabase
      .from('picks')
      .select('*')
      .eq('game_id', games.id)
      .eq('picker', savedPlayer)

    if (existingPicks) {
      const loaded: Record<string, Record<string, boolean>> = {}
      PLAYERS.forEach(p => {
        loaded[p] = {}
        STATS.forEach(s => {
          const pick = existingPicks.find(pk => pk.player === p && pk.stat === s)
          loaded[p][s] = pick?.picked || false
        })
      })
      setPicks(loaded)
    } else {
      // Initialize empty picks
      const initial: Record<string, Record<string, boolean>> = {}
      PLAYERS.forEach(p => {
        initial[p] = {}
        STATS.forEach(s => {
          initial[p][s] = false
        })
      })
      setPicks(initial)
    }

    // Load existing prop picks
    const { data: existingPropPicks } = await supabase
      .from('prop_picks')
      .select('*')
      .eq('game_id', games.id)
      .eq('picker', savedPlayer)

    if (existingPropPicks) {
      const loaded: Record<string, string> = {}
      existingPropPicks.forEach(p => {
        loaded[p.prop_type] = p.player_picked
      })
      setPropPicks(loaded)
    }

    setLoading(false)
  }, [])

  const calculateAndSaveLines = async (gId: string) => {
    // Get all predictions
    const { data: predictions } = await supabase
      .from('line_predictions')
      .select('*')
      .eq('game_id', gId)

    if (!predictions || predictions.length === 0) return

    // Calculate averaged lines
    const linesToInsert: Array<{
      game_id: string
      player: string
      stat: string
      value: number
    }> = []

    PLAYERS.forEach(p => {
      STATS.forEach(s => {
        const values = predictions
          .filter(pred => pred.player === p && pred.stat === s)
          .map(pred => pred.value)

        if (values.length > 0) {
          linesToInsert.push({
            game_id: gId,
            player: p,
            stat: s,
            value: calculateAveragedLine(values),
          })
        }
      })
    })

    await supabase
      .from('lines')
      .upsert(linesToInsert, { onConflict: 'game_id,player,stat' })
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const togglePick = (targetPlayer: string, stat: string) => {
    setPicks(prev => ({
      ...prev,
      [targetPlayer]: {
        ...prev[targetPlayer],
        [stat]: !prev[targetPlayer]?.[stat],
      },
    }))
  }

  const handlePropPick = (propType: string, pickedPlayer: string) => {
    setPropPicks(prev => ({
      ...prev,
      [propType]: pickedPlayer,
    }))
  }

  const handleSubmit = async () => {
    if (!player || !gameId) return
    setSaving(true)

    // Save line picks
    const picksToInsert: Array<{
      game_id: string
      picker: string
      player: string
      stat: string
      picked: boolean
      locked: boolean
    }> = []

    PLAYERS.forEach(p => {
      STATS.forEach(s => {
        picksToInsert.push({
          game_id: gameId,
          picker: player,
          player: p,
          stat: s,
          picked: picks[p]?.[s] || false,
          locked: phase === 'game_started',
        })
      })
    })

    await supabase
      .from('picks')
      .upsert(picksToInsert, { onConflict: 'game_id,picker,player,stat' })

    // Save prop picks
    const propPicksToInsert = Object.entries(propPicks)
      .filter(([, pickedPlayer]) => pickedPlayer)
      .map(([propType, pickedPlayer]) => ({
        game_id: gameId,
        picker: player,
        prop_type: propType,
        player_picked: pickedPlayer,
      }))

    if (propPicksToInsert.length > 0) {
      await supabase
        .from('prop_picks')
        .upsert(propPicksToInsert, { onConflict: 'game_id,picker,prop_type' })
    }

    setSaving(false)
    alert('Picks saved!')
  }

  const getLine = (targetPlayer: string, stat: string): number | null => {
    const line = lines.find(l => l.player === targetPlayer && l.stat === stat)
    return line?.value ?? null
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

  const isLocked = phase === 'game_started'
  const linesNotReady = phase === 'lines_open'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Make Picks</h1>
        <span className="text-gray-400 capitalize">Playing as: {player}</span>
      </div>

      {linesNotReady && (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-400">
            Lines haven&apos;t locked yet. Your picks won&apos;t be locked until 4:30pm.
          </p>
        </div>
      )}

      {isLocked && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">Picks are locked. Game has started!</p>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Line Picks</h2>
        <p className="text-gray-400 text-sm mb-4">
          Tap to bet they&apos;ll hit the over. Support the squad! 🔥
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-2 py-2 text-left text-sm">Player</th>
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
                  <td className="px-2 py-2 capitalize text-sm font-medium">{targetPlayer}</td>
                  {STATS.map(stat => {
                    const line = getLine(targetPlayer, stat)
                    const isPicked = picks[targetPlayer]?.[stat]

                    return (
                      <td key={stat} className="px-2 py-2 text-center">
                        <button
                          onClick={() => !isLocked && togglePick(targetPlayer, stat)}
                          disabled={isLocked}
                          className={`w-14 h-10 rounded text-sm font-medium transition-colors ${
                            isPicked
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          } disabled:opacity-50`}
                        >
                          {line !== null ? line : '-'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-400">
          <span className="inline-block w-3 h-3 bg-green-600 rounded mr-1"></span>
          = Picked Over
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Prop Bets</h2>

        <div className="space-y-4">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm font-medium mb-2">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-6 gap-2">
                {PLAYERS.map(p => (
                  <button
                    key={p}
                    onClick={() => !isLocked && handlePropPick(prop, p)}
                    disabled={isLocked}
                    className={`px-2 py-2 rounded text-xs capitalize transition-colors ${
                      propPicks[prop] === p
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isLocked && (
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Picks'}
        </button>
      )}
    </div>
  )
}
