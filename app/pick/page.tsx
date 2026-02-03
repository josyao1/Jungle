'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, PROP_BETS, PROP_BET_LABELS, GAMES, getGamePhase, Player, Stat, PropBet } from '@/lib/constants'
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
      const initial: Record<string, Record<string, boolean>> = {}
      PLAYERS.forEach(p => {
        initial[p] = {}
        STATS.forEach(s => {
          initial[p][s] = false
        })
      })
      setPicks(initial)
    }

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
              {PLAYERS.map(targetPlayer => (
                <tr key={targetPlayer}>
                  <td className="capitalize font-medium">{targetPlayer}</td>
                  {STATS.map(stat => {
                    const line = getLine(targetPlayer, stat)
                    const isPicked = picks[targetPlayer]?.[stat]

                    return (
                      <td key={stat} className="text-center">
                        <button
                          onClick={() => !isLocked && togglePick(targetPlayer, stat)}
                          disabled={isLocked}
                          className={`w-12 md:w-14 h-10 rounded-lg text-sm font-medium transition-all pick-btn ${
                            isPicked ? 'selected' : ''
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

        <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-green-500 rounded bg-green-500/20"></span>
          = Picked Over
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Prop Bets</h2>

        <div className="space-y-6">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm text-slate-300 mb-3">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {PLAYERS.map(p => (
                  <button
                    key={p}
                    onClick={() => !isLocked && handlePropPick(prop, p)}
                    disabled={isLocked}
                    className={`px-2 py-3 rounded-lg text-xs capitalize font-medium transition-all pick-btn ${
                      propPicks[prop] === p ? 'selected' : ''
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
    </div>
  )
}
