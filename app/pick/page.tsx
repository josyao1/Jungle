'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, PROP_BETS, PROP_BET_LABELS, GAMES, getGamePhase, Player, Stat, PropBet, isPlayerInjured } from '@/lib/constants'
import PlayerSelect from '@/components/PlayerSelect'
import { supabase, Line, Pick, PropPick } from '@/lib/supabase'
import { calculateAveragedLine } from '@/lib/utils'

export default function PickPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [lines, setLines] = useState<Line[]>([])
  const [picks, setPicks] = useState<Record<string, Record<string, boolean>>>({})
  const [propPicks, setPropPicks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<string>('lines_open')
  const [results, setResults] = useState<Array<{ player: string; stat: string; value: number }>>([])
  const [userPredictions, setUserPredictions] = useState<Array<{ player: string; stat: string; value: number }>>([])
  const [propResults, setPropResults] = useState<Record<string, string>>({})
  const [autoPickedCells, setAutoPickedCells] = useState<Array<{ player: string; stat: string }>>([])
  const [showAutoPickAlert, setShowAutoPickAlert] = useState(false)
  const [autoPickDisabled, setAutoPickDisabled] = useState(false)

  const loadData = useCallback(async (weekNum?: number) => {
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

    const gameToLoad = weekNum ? GAMES.find(g => g.number === weekNum) || currentGame : currentGame
    if (!weekNum) {
      setSelectedWeek(currentGame.number)
    }

    const currentPhase = getGamePhase(gameToLoad)
    setPhase(currentPhase)

    let { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('game_number', gameToLoad.number)
      .single()

    if (!games) {
      const { data: newGame } = await supabase
        .from('games')
        .insert({
          game_number: gameToLoad.number,
          game_date: gameToLoad.date.toISOString(),
          lines_lock_time: gameToLoad.lockTime.toISOString(),
          picks_lock_time: gameToLoad.lockTime.toISOString(),
          status: 'upcoming'
        })
        .select('id')
        .single()

      if (!newGame) {
        setLoading(false)
        return
      }
      games = newGame
    }
    setGameId(games.id)

    await calculateAndSaveLines(games.id)
    const { data: liveLines } = await supabase
      .from('lines')
      .select('*')
      .eq('game_id', games.id)

    setLines(liveLines || [])

    // Fetch results for correct/incorrect display on past picks
    const { data: gameResults } = await supabase
      .from('results')
      .select('*')
      .eq('game_id', games.id)
    setResults(gameResults || [])

    // Fetch prop results for correct/incorrect display on past picks
    const { data: gamePropResults } = await supabase
      .from('prop_results')
      .select('*')
      .eq('game_id', games.id)
    const propResultsMap: Record<string, string> = {}
    gamePropResults?.forEach((pr: any) => {
      propResultsMap[pr.prop_type] = pr.winner
    })
    setPropResults(propResultsMap)

    // Fetch user's line predictions for auto-pick logic
    const { data: userPreds } = await supabase
      .from('line_predictions')
      .select('*')
      .eq('game_id', games.id)
      .eq('submitter', savedPlayer)
    setUserPredictions(userPreds || [])

    const { data: existingPicks } = await supabase
      .from('picks')
      .select('*')
      .eq('game_id', games.id)
      .eq('picker', savedPlayer)

    // Load existing picks or start fresh
    const picksMap: Record<string, Record<string, boolean>> = {}
    PLAYERS.forEach(p => {
      picksMap[p] = {}
      STATS.forEach(s => {
        const pick = existingPicks?.find(pk => pk.player === p && pk.stat === s)
        picksMap[p][s] = pick?.picked || false
      })
    })

    // Auto-pick on every load: if aggregated line < user's prediction, pick it
    // Never un-pick something already chosen
    const autoPickOff = localStorage.getItem(`jungle_autopick_off_week_${gameToLoad.number}`)
    setAutoPickDisabled(!!autoPickOff)
    const newAutoPicked: Array<{ player: string; stat: string }> = []

    if (!autoPickOff && currentPhase !== 'locked' && userPreds && liveLines) {
      PLAYERS.forEach(p => {
        STATS.forEach(s => {
          if (picksMap[p][s]) return // Already picked, never un-pick
          const userPred = userPreds.find((pred: any) => pred.player === p && pred.stat === s)
          const aggLine = (liveLines || []).find((l: any) => l.player === p && l.stat === s)
          if (userPred && aggLine && aggLine.value < userPred.value) {
            picksMap[p][s] = true
            newAutoPicked.push({ player: p, stat: s })
          }
        })
      })
    }

    setPicks(picksMap)
    setAutoPickedCells(newAutoPicked)
    setShowAutoPickAlert(newAutoPicked.length > 0)

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

  const handleWeekChange = (weekNum: number) => {
    setSelectedWeek(weekNum)
    setLoading(true)
    loadData(weekNum)
  }

  const calculateAndSaveLines = async (gId: string) => {
    const { data: predictions } = await supabase
      .from('line_predictions')
      .select('*')
      .eq('game_id', gId)

    await supabase.from('lines').delete().eq('game_id', gId)

    if (!predictions || predictions.length === 0) return

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

    if (linesToInsert.length > 0) {
      await supabase.from('lines').insert(linesToInsert)
    }
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

  const handleDismissAutoPick = () => {
    setShowAutoPickAlert(false)
  }

  const handleTurnOffAutoPick = () => {
    // Undo the auto-picked cells
    setPicks(prev => {
      const updated = { ...prev }
      autoPickedCells.forEach(({ player: p, stat: s }) => {
        updated[p] = { ...updated[p], [s]: false }
      })
      return updated
    })
    // Remember for this week
    localStorage.setItem(`jungle_autopick_off_week_${selectedWeek}`, 'true')
    setAutoPickDisabled(true)
    setAutoPickedCells([])
    setShowAutoPickAlert(false)
  }

  const handleTurnOnAutoPick = () => {
    localStorage.removeItem(`jungle_autopick_off_week_${selectedWeek}`)
    setAutoPickDisabled(false)
    // Re-run load to apply auto-picks
    setLoading(true)
    loadData(selectedWeek)
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

    await supabase.from('picks').upsert(picksToInsert, { onConflict: 'game_id,picker,player,stat' })

    const propPicksToInsert = Object.entries(propPicks)
      .filter(([, pickedPlayer]) => pickedPlayer)
      .map(([propType, pickedPlayer]) => ({
        game_id: gameId,
        picker: player,
        prop_type: propType,
        player_picked: pickedPlayer,
      }))

    if (propPicksToInsert.length > 0) {
      await supabase.from('prop_picks').upsert(propPicksToInsert, { onConflict: 'game_id,picker,prop_type' })
    }

    setSaving(false)
    alert('Picks saved!')
  }

  const getLine = (targetPlayer: string, stat: string): number | null => {
    const line = lines.find(l => l.player === targetPlayer && l.stat === stat)
    return line?.value ?? null
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

  const getPickResult = (targetPlayer: string, stat: string): 'correct' | 'incorrect' | null => {
    if (!isLocked) return null
    const isPicked = picks[targetPlayer]?.[stat]
    if (!isPicked) return null
    const line = getLine(targetPlayer, stat)
    const result = results.find(r => r.player === targetPlayer && r.stat === stat)
    if (line === null || !result) return null
    return result.value >= line ? 'correct' : 'incorrect'
  }

  const getPropPickResult = (propType: string, pickedPlayer: string): 'correct' | 'incorrect' | null => {
    if (!isLocked) return null
    if (!propPicks[propType]) return null
    const winnerStr = propResults[propType]
    if (!winnerStr) return null
    const winners = winnerStr.split(',').map(w => w.trim())
    return winners.includes(pickedPlayer) ? 'correct' : 'incorrect'
  }

  const now = new Date()
  const currentGameNum = (GAMES.find(g => {
    const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
    return now < gameEnd
  }) || GAMES[GAMES.length - 1]).number

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Make Picks - Week {selectedWeek}</h1>
        <PlayerSelect onSelect={setPlayer} selected={player} compact />
      </div>

      <div className="week-selector">
        {GAMES.map(g => (
          <button
            key={g.number}
            onClick={() => handleWeekChange(g.number)}
            className={`week-btn ${selectedWeek === g.number ? 'active' : ''}`}
          >
            Week {g.number}
            {g.number === currentGameNum && <span className="ml-1 text-xs opacity-75">(Current)</span>}
          </button>
        ))}
      </div>

      {!isLocked && (
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Picks'}
        </button>
      )}

      {isLocked && (
        <div className="glass-card rounded-xl p-4 border-red-500/30">
          <p className="text-red-400 text-sm">Picks are locked. Game has started!</p>
        </div>
      )}

      {!isLocked && lines.length === 0 && (
        <div className="glass-card rounded-xl p-4 border-yellow-500/30">
          <p className="text-yellow-400 text-sm">No lines yet. Set some lines first!</p>
        </div>
      )}

      {showAutoPickAlert && (
        <div className="glass-card rounded-xl p-4 border-blue-500/30">
          <p className="text-blue-400 text-sm mb-2">
            Auto-picked {autoPickedCells.length} over{autoPickedCells.length > 1 ? 's' : ''} where the line is {'>'}1 below your prediction:
          </p>
          <p className="text-slate-400 text-xs mb-3 capitalize">
            {autoPickedCells.map(c => `${c.player} ${STAT_LABELS[c.stat as Stat]}`).join(', ')}
          </p>
          <div className="flex gap-2">
            <button onClick={handleDismissAutoPick} className="btn-secondary px-3 py-1.5 rounded-lg text-xs">
              Got It
            </button>
            <button onClick={handleTurnOffAutoPick} className="btn-secondary px-3 py-1.5 rounded-lg text-xs text-red-400">
              Turn Off For This Week
            </button>
          </div>
        </div>
      )}

      {!isLocked && autoPickDisabled && !showAutoPickAlert && (
        <div className="glass-card rounded-xl p-3 border-slate-500/20 flex items-center justify-between">
          <p className="text-slate-500 text-xs">Auto-pick is off for this week</p>
          <button onClick={handleTurnOnAutoPick} className="btn-secondary px-3 py-1 rounded-lg text-xs text-blue-400">
            Turn On
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Line Picks</h2>
        <p className="text-slate-500 text-sm mb-4">
          Tap to bet on the over. Support the squad!
        </p>

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
              {PLAYERS.map(targetPlayer => {
                const injured = isPlayerInjured(targetPlayer)
                return (
                  <tr key={targetPlayer} className={injured ? 'player-injured' : ''}>
                    <td className="capitalize font-medium">
                      {targetPlayer}
                      {injured && <span className="badge badge-ir ml-2">IR</span>}
                    </td>
                    {STATS.map(stat => {
                      if (injured) {
                        return (
                          <td key={stat} className="text-center">
                            <span className="text-slate-600">—</span>
                          </td>
                        )
                      }
                      const line = getLine(targetPlayer, stat)
                      const isPicked = picks[targetPlayer]?.[stat]
                      const pickResult = getPickResult(targetPlayer, stat)

                      return (
                        <td key={stat} className="text-center">
                          <button
                            onClick={() => !isLocked && togglePick(targetPlayer, stat)}
                            disabled={isLocked}
                            className={`w-14 md:w-16 h-10 rounded-lg text-sm font-medium transition-all pick-btn ${
                              pickResult === 'correct' ? 'pick-correct'
                              : pickResult === 'incorrect' ? 'pick-incorrect'
                              : isPicked ? 'selected' : ''
                            } disabled:opacity-50`}
                          >
                            {line !== null ? Math.max(0, line - 0.5) : '-'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 border-2 border-green-500 rounded bg-green-500/20"></span>
            {isLocked ? '= Hit' : '= Picked Over'}
          </span>
          {isLocked && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 border-2 border-red-500 rounded bg-red-500/20"></span>
              = Miss
            </span>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Prop Bets</h2>

        <div className="space-y-6">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm text-slate-300 mb-3">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {PLAYERS.map(p => {
                  const injured = isPlayerInjured(p)
                  const propResult = propPicks[prop] === p ? getPropPickResult(prop, p) : null
                  return (
                    <button
                      key={p}
                      onClick={() => !isLocked && !injured && handlePropPick(prop, p)}
                      disabled={isLocked || injured}
                      className={`px-2 py-3 rounded-lg text-xs capitalize font-medium transition-all pick-btn ${
                        propResult === 'correct' ? 'pick-correct'
                        : propResult === 'incorrect' ? 'pick-incorrect'
                        : propPicks[prop] === p ? 'selected' : ''
                      } ${injured ? 'player-injured' : ''} disabled:opacity-50`}
                    >
                      {p}{injured && ' (IR)'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
