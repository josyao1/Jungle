'use client'

export const dynamic = 'force-dynamic'

/**
 * Pick page — Players submit over/under picks against the averaged lines.
 * Inactive players are shown at the bottom with blank cells and an OUT badge.
 * Picks lock when the game starts (lockTime). +1 correct, -0.5 missed.
 */

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, STATS, STAT_LABELS, GAMES, PROP_BETS, PROP_BET_LABELS, getGamePhase, sortWithInactiveAtBottom, Player, Stat } from '@/lib/constants'
import PlayerSelect from '@/components/PlayerSelect'
import { supabase, Line, Pick, getInactivePlayersForGame } from '@/lib/supabase'
import { calculateAveragedLine } from '@/lib/utils'

const PLAYER_HUES: Record<string, string> = {
  joshua:'#22c55e', ronit:'#f59e0b', aarnav:'#06b6d4', evan:'#a855f7',
  andrew:'#f97316', rohit:'#ec4899', teja:'#10b981', aiyan:'#3b82f6',
  salil:'#eab308', Jay:'#8b5cf6', Tommy:'#84cc16', Neo:'#d946ef',
}
const PLAYERS_WITH_PHOTOS = new Set(['joshua','ronit','aarnav','evan','andrew','rohit','teja','aiyan','salil'])
const STAT_SHORT: Record<string, string> = {
  hits: 'H', rbis: 'RBI', totalbases: 'Total Bases', errors: 'Errors', strikeouts: 'K',
}

export default function PickPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [lines, setLines] = useState<Line[]>([])
  const [picks, setPicks] = useState<Record<string, Record<string, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [phase, setPhase] = useState<string>('open')
  const [results, setResults] = useState<Array<{ player: string; stat: string; value: number }>>([])
  const [userPredictions, setUserPredictions] = useState<Array<{ player: string; stat: string; value: number }>>([])
  const [inactivePlayers, setInactivePlayers] = useState<Map<string, string>>(new Map())
  const [propPicks, setPropPicks] = useState<Record<string, string>>({})
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
    if (!weekNum) setSelectedWeek(currentGame.number)

    const currentPhase = getGamePhase(gameToLoad)
    setPhase(currentPhase)

    let { data: games } = await supabase
      .from('jungle_games')
      .select('id')
      .eq('game_number', gameToLoad.number)
      .single()

    if (!games) {
      const { data: newGame } = await supabase
        .from('jungle_games')
        .insert({
          game_number: gameToLoad.number,
          game_date: gameToLoad.date.toISOString(),
          lines_lock_time: gameToLoad.lockTime.toISOString(),
          picks_lock_time: gameToLoad.lockTime.toISOString(),
          status: 'upcoming',
          forfeited: false,
        })
        .select('id')
        .single()

      if (!newGame) { setLoading(false); return }
      games = newGame
    }
    setGameId(games.id)

    const inactive = await getInactivePlayersForGame(games.id)
    setInactivePlayers(inactive)
    const active = PLAYERS.filter(p => !inactive.has(p))

    await calculateAndSaveLines(games.id, active)
    const { data: liveLines } = await supabase
      .from('jungle_lines')
      .select('*')
      .eq('game_id', games.id)
    setLines(liveLines || [])

    const { data: gameResults } = await supabase
      .from('jungle_results')
      .select('*')
      .eq('game_id', games.id)
    setResults(gameResults || [])

    const { data: userPreds } = await supabase
      .from('jungle_line_predictions')
      .select('*')
      .eq('game_id', games.id)
      .eq('submitter', savedPlayer)
    setUserPredictions(userPreds || [])

    // Load prop picks
    const { data: existingPropPicks } = await supabase
      .from('jungle_prop_picks')
      .select('*')
      .eq('game_id', games.id)
      .eq('picker', savedPlayer)
    const propPicksMap: Record<string, string> = {}
    existingPropPicks?.forEach((p: any) => { propPicksMap[p.prop_type] = p.player_picked })
    setPropPicks(propPicksMap)

    // Load prop results for display
    const { data: gamePropResults } = await supabase
      .from('jungle_prop_results')
      .select('*')
      .eq('game_id', games.id)
    const propResultsMap: Record<string, string> = {}
    gamePropResults?.forEach((pr: any) => { propResultsMap[pr.prop_type] = pr.winner })
    setPropResults(propResultsMap)

    const { data: existingPicks } = await supabase
      .from('jungle_picks')
      .select('*')
      .eq('game_id', games.id)
      .eq('picker', savedPlayer)

    const picksMap: Record<string, Record<string, boolean>> = {}
    PLAYERS.forEach(p => {
      picksMap[p] = {}
      STATS.forEach(s => {
        const pick = existingPicks?.find(pk => pk.player === p && pk.stat === s)
        picksMap[p][s] = pick?.picked || false
      })
    })

    const autoPickOff = localStorage.getItem(`jungle_autopick_off_week_${gameToLoad.number}`)
    setAutoPickDisabled(!!autoPickOff)
    const newAutoPicked: Array<{ player: string; stat: string }> = []

    if (!autoPickOff && currentPhase !== 'locked' && userPreds && liveLines) {
      PLAYERS.filter(p => !inactive.has(p)).forEach(p => {
        STATS.forEach(s => {
          if (picksMap[p][s]) return
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
    setLoading(false)
  }, [])

  const handleWeekChange = (weekNum: number) => {
    setSelectedWeek(weekNum)
    setLoading(true)
    loadData(weekNum)
  }

  const calculateAndSaveLines = async (gId: string, active: string[]) => {
    const { data: predictions } = await supabase
      .from('jungle_line_predictions')
      .select('*')
      .eq('game_id', gId)

    await supabase.from('jungle_lines').delete().eq('game_id', gId)
    if (!predictions || predictions.length === 0) return

    const linesToInsert: Array<{ game_id: string; player: string; stat: string; value: number }> = []

    active.forEach(p => {
      STATS.forEach(s => {
        const values = predictions
          .filter(pred => pred.player === p && pred.stat === s)
          .map(pred => pred.value)
        if (values.length > 0) {
          linesToInsert.push({ game_id: gId, player: p, stat: s, value: calculateAveragedLine(values) })
        }
      })
    })

    if (linesToInsert.length > 0) {
      await supabase.from('jungle_lines').insert(linesToInsert)
    }
  }

  useEffect(() => { loadData() }, [loadData])

  const autoSave = async (newPicks: Record<string, Record<string, boolean>>) => {
    if (!player || !gameId) return
    setSaveStatus('saving')
    const picksToInsert = PLAYERS.filter(p => !inactivePlayers.has(p)).flatMap(p =>
      STATS.map(s => ({
        game_id: gameId,
        picker: player,
        player: p,
        stat: s,
        picked: newPicks[p]?.[s] || false,
        locked: phase === 'locked',
      }))
    )
    await supabase.from('jungle_picks').upsert(picksToInsert, { onConflict: 'game_id,picker,player,stat' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const togglePick = (targetPlayer: string, stat: string) => {
    setPicks(prev => {
      const updated = {
        ...prev,
        [targetPlayer]: { ...prev[targetPlayer], [stat]: !prev[targetPlayer]?.[stat] },
      }
      autoSave(updated)
      return updated
    })
  }

  const handleDismissAutoPick = () => setShowAutoPickAlert(false)

  const handleTurnOffAutoPick = () => {
    setPicks(prev => {
      const updated = { ...prev }
      autoPickedCells.forEach(({ player: p, stat: s }) => {
        updated[p] = { ...updated[p], [s]: false }
      })
      return updated
    })
    localStorage.setItem(`jungle_autopick_off_week_${selectedWeek}`, 'true')
    setAutoPickDisabled(true)
    setAutoPickedCells([])
    setShowAutoPickAlert(false)
  }

  const handleTurnOnAutoPick = () => {
    localStorage.removeItem(`jungle_autopick_off_week_${selectedWeek}`)
    setAutoPickDisabled(false)
    setLoading(true)
    loadData(selectedWeek)
  }

  const autoSavePropPick = async (propType: string, pickedPlayer: string) => {
    if (!player || !gameId) return
    setSaveStatus('saving')
    await supabase.from('jungle_prop_picks').upsert({
      game_id: gameId,
      picker: player,
      prop_type: propType,
      player_picked: pickedPlayer,
    }, { onConflict: 'game_id,picker,prop_type' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const getLine = (targetPlayer: string, stat: string): number | null => {
    const line = lines.find(l => l.player === targetPlayer && l.stat === stat)
    return line?.value ?? null
  }

  const getPropPickResult = (propType: string, pickedPlayer: string): 'correct' | 'incorrect' | null => {
    if (phase !== 'locked') return null
    if (propPicks[propType] !== pickedPlayer) return null
    const winnerStr = propResults[propType]
    if (!winnerStr) return null
    const winners = winnerStr.split(',').map(w => w.trim())
    return winners.includes(pickedPlayer) ? 'correct' : 'incorrect'
  }

  const getPickResult = (targetPlayer: string, stat: string): 'correct' | 'incorrect' | null => {
    if (phase !== 'locked') return null
    if (!picks[targetPlayer]?.[stat]) return null
    const line = getLine(targetPlayer, stat)
    const result = results.find(r => r.player === targetPlayer && r.stat === stat)
    if (line === null || !result) return null
    return result.value >= line ? 'correct' : 'incorrect'
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

  const isLocked = phase === 'locked'
  const now = new Date()
  const currentGameNum = (GAMES.find(g => {
    const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
    return now < gameEnd
  }) || GAMES[GAMES.length - 1]).number

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Make Picks — {GAMES.find(g => g.number === selectedWeek)?.label || `Week ${selectedWeek}`}</h1>
        <PlayerSelect onSelect={setPlayer} selected={player} compact />
      </div>

      {/* Set lines nudge — secondary entry point, not part of the picks flow */}
      {!isLocked && (
        <a
          href="/set-lines"
          className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
          style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}
        >
          <div>
            <span className="text-sm font-medium text-slate-300">Want to help set the lines?</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit your stat predictions — everyone's get averaged into the official line.
            </p>
          </div>
          <span className="text-green-500 text-lg shrink-0 ml-3">→</span>
        </a>
      )}

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


      {isLocked && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30">
          <p className="text-red-400 text-sm">Picks are locked. Game has started!</p>
        </div>
      )}

      {!isLocked && lines.length === 0 && (
        <div className="glass-card rounded-xl p-4 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm">No lines yet — set some lines first!</p>
        </div>
      )}

      {showAutoPickAlert && (
        <div className="glass-card rounded-xl p-4 border border-blue-500/30">
          <p className="text-blue-400 text-sm mb-2">
            Auto-picked {autoPickedCells.length} over{autoPickedCells.length > 1 ? 's' : ''} where the line is below your prediction
          </p>
          <p className="text-slate-400 text-xs mb-3 capitalize">
            {autoPickedCells.map(c => `${c.player} ${STAT_LABELS[c.stat as Stat]}`).join(', ')}
          </p>
          <div className="flex gap-2">
            <button onClick={handleDismissAutoPick} className="btn-secondary px-3 py-1.5 rounded-lg text-xs">Got It</button>
            <button onClick={handleTurnOffAutoPick} className="btn-secondary px-3 py-1.5 rounded-lg text-xs text-red-400">Turn Off For This Week</button>
          </div>
        </div>
      )}

      {!isLocked && autoPickDisabled && !showAutoPickAlert && (
        <div className="glass-card rounded-xl p-3 border border-slate-500/20 flex items-center justify-between">
          <p className="text-slate-500 text-xs">Auto-pick is off for this week</p>
          <button onClick={handleTurnOnAutoPick} className="btn-secondary px-3 py-1 rounded-lg text-xs text-blue-400">Turn On</button>
        </div>
      )}

      <div className="glass-card rounded-2xl p-3 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Line Picks</h2>
          <span className="text-xs transition-all"
            style={{
              color: saveStatus === 'saving' ? '#64748b' : '#22c55e',
              opacity: saveStatus === 'idle' ? 0 : 1,
            }}>
            {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
          </span>
        </div>

        {/* Sticky stat column headers */}
        <div className="sticky z-10 grid items-center py-1.5 mb-2 -mx-3 px-3 md:-mx-5 md:px-5"
          style={{
            top: '60px',
            gridTemplateColumns: '110px repeat(5, 1fr)',
            background: 'rgba(13,26,18,0.97)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(34,197,94,0.06)',
          }}>
          <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">Player</div>
          {STATS.map(stat => (
            <div key={stat} className="text-center text-xs text-slate-600 font-bold uppercase tracking-wider">
              {STAT_SHORT[stat]}
            </div>
          ))}
        </div>

        {/* Player card rows */}
        <div className="space-y-1.5">
          {sortWithInactiveAtBottom(PLAYERS, inactivePlayers).map(targetPlayer => {
            const isInactive = inactivePlayers.has(targetPlayer)
            const color = PLAYER_HUES[targetPlayer] || '#22c55e'
            const hasPhoto = PLAYERS_WITH_PHOTOS.has(targetPlayer)

            return (
              <div key={targetPlayer}
                className="grid items-center rounded-xl px-2 py-2"
                style={{
                  gridTemplateColumns: '110px repeat(5, 1fr)',
                  background: isInactive ? 'rgba(6,11,8,0.35)' : 'rgba(15,35,24,0.5)',
                  border: `1px solid ${isInactive ? 'rgba(255,255,255,0.03)' : `${color}15`}`,
                  borderLeft: `3px solid ${isInactive ? 'rgba(100,116,139,0.25)' : color}`,
                }}>

                {/* Player cell */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: hasPhoto ? undefined : `${color}18`, border: `1.5px solid ${color}40` }}>
                    {hasPhoto
                      ? <img src={`/players/${targetPlayer}.png`} alt={targetPlayer} className="w-full h-full object-cover" />
                      : <span style={{ color, fontSize: '0.65rem', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>{targetPlayer.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <span className="capitalize text-xs font-semibold text-slate-200 truncate block">{targetPlayer}</span>
                    {isInactive && <span className="badge badge-out">{inactivePlayers.get(targetPlayer) || 'OUT'}</span>}
                  </div>
                </div>

                {/* Pick chip cells */}
                {STATS.map(stat => {
                  if (isInactive) {
                    return <div key={stat} className="flex justify-center"><span className="text-slate-700 text-xs">—</span></div>
                  }
                  const line = getLine(targetPlayer, stat)
                  const isPicked = picks[targetPlayer]?.[stat]
                  const pickResult = getPickResult(targetPlayer, stat)

                  const chipBg = pickResult === 'correct' ? 'rgba(34,197,94,0.18)'
                    : pickResult === 'incorrect' ? 'rgba(239,68,68,0.12)'
                    : isPicked ? 'rgba(34,197,94,0.12)'
                    : 'rgba(6,11,8,0.7)'
                  const chipBorder = pickResult === 'correct' ? '1px solid rgba(34,197,94,0.55)'
                    : pickResult === 'incorrect' ? '1px solid rgba(239,68,68,0.35)'
                    : isPicked ? '1px solid rgba(34,197,94,0.4)'
                    : '1px solid rgba(255,255,255,0.06)'
                  const chipColor = pickResult === 'correct' ? '#22c55e'
                    : pickResult === 'incorrect' ? '#f87171'
                    : isPicked ? '#22c55e'
                    : '#475569'
                  const chipGlow = (isPicked && !pickResult) ? '0 0 6px rgba(34,197,94,0.1)' : pickResult === 'correct' ? '0 0 8px rgba(34,197,94,0.2)' : 'none'

                  return (
                    <div key={stat} className="flex justify-center">
                      <button
                        onClick={() => !isLocked && togglePick(targetPlayer, stat)}
                        disabled={isLocked}
                        style={{
                          background: chipBg,
                          border: chipBorder,
                          color: chipColor,
                          boxShadow: chipGlow,
                          borderRadius: '7px',
                          padding: '3px 5px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          minWidth: '38px',
                          height: '28px',
                          transition: 'all 0.12s ease',
                          cursor: isLocked ? 'default' : 'pointer',
                        }}
                        className="disabled:opacity-40"
                      >
                        {line !== null ? Math.max(0, line - 0.5) : '—'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.45)' }}></span>
            {isLocked ? 'Hit' : 'Picked over'}
          </span>
          {isLocked && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)' }}></span>
              Miss
            </span>
          )}
        </div>
      </div>

      {/* Prop Bets */}
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Prop Bets</h2>
        <div className="space-y-6">
          {PROP_BETS.map(prop => (
            <div key={prop}>
              <h3 className="text-sm text-slate-300 mb-3 font-medium">{PROP_BET_LABELS[prop]}</h3>
              <div className="grid grid-cols-3 gap-2">
                {PLAYERS.filter(p => !inactivePlayers.has(p)).map(p => {
                  const propResult = getPropPickResult(prop, p)
                  const isSelected = propPicks[prop] === p
                  return (
                    <button
                      key={p}
                      onClick={() => { if (!isLocked) { setPropPicks(prev => ({ ...prev, [prop]: p })); autoSavePropPick(prop, p) } }}
                      disabled={isLocked}
                      className={`px-2 py-3 rounded-lg text-xs capitalize font-medium transition-all pick-btn ${
                        propResult === 'correct' ? 'pick-correct'
                        : propResult === 'incorrect' ? 'pick-incorrect'
                        : isSelected ? 'selected' : ''
                      } disabled:opacity-50`}
                    >
                      {p}
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
