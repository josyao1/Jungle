'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, GAMES, Player } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface GameData {
  id: string
  game_number: number
  forfeited: boolean
}

interface AvailabilityMap {
  [gameId: string]: {
    [player: string]: boolean
  }
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [games, setGames] = useState<GameData[]>([])
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedGame, setSelectedGame] = useState<number>(1)

  const loadData = useCallback(async () => {
    const savedPlayer = localStorage.getItem('jungle_player')
    setCurrentUser(savedPlayer)

    const { data: gamesData } = await supabase
      .from('jungle_games')
      .select('id, game_number, forfeited')
      .order('game_number')

    if (!gamesData) {
      setLoading(false)
      return
    }

    // Ensure all 5 games exist
    const existingNums = new Set(gamesData.map((g: any) => g.game_number))
    for (const game of GAMES) {
      if (!existingNums.has(game.number)) {
        await supabase.from('jungle_games').insert({
          game_number: game.number,
          game_date: game.date.toISOString(),
          lines_lock_time: game.lockTime.toISOString(),
          picks_lock_time: game.lockTime.toISOString(),
          status: 'upcoming',
          forfeited: false,
        })
      }
    }

    // Re-fetch after possible inserts
    const { data: refreshed } = await supabase
      .from('jungle_games')
      .select('id, game_number, forfeited')
      .order('game_number')

    const gamesList = refreshed || gamesData
    setGames(gamesList as GameData[])

    // Load availability for all games
    const { data: availData } = await supabase
      .from('jungle_player_availability')
      .select('game_id, player, active')

    const availMap: AvailabilityMap = {}
    gamesList.forEach((g: any) => {
      availMap[g.id] = {}
      PLAYERS.forEach(p => {
        availMap[g.id][p] = true // default active
      })
    })

    availData?.forEach((row: any) => {
      if (availMap[row.game_id]) {
        availMap[row.game_id][row.player] = row.active
      }
    })

    setAvailability(availMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const togglePlayerAvailability = async (gameId: string, player: string) => {
    const current = availability[gameId]?.[player] ?? true
    const newValue = !current

    setAvailability(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [player]: newValue,
      },
    }))

    await supabase
      .from('jungle_player_availability')
      .upsert({ game_id: gameId, player, active: newValue }, { onConflict: 'game_id,player' })
  }

  const toggleForfeit = async (game: GameData) => {
    const newValue = !game.forfeited

    setSaving(true)
    await supabase
      .from('jungle_games')
      .update({ forfeited: newValue })
      .eq('id', game.id)

    setGames(prev => prev.map(g => g.id === game.id ? { ...g, forfeited: newValue } : g))

    if (newValue) {
      // Zero out scores for this game
      const { data: existingScores } = await supabase
        .from('jungle_scores')
        .select('id')
        .eq('game_id', game.id)
        .limit(1)

      if (existingScores && existingScores.length > 0) {
        await supabase.from('jungle_scores').delete().eq('game_id', game.id)
      }
    }

    setSaving(false)
    alert(newValue ? 'Game marked as forfeited. Scores zeroed.' : 'Forfeit removed.')
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>
  }

  if (currentUser !== 'joshua') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-2">Admin access restricted to Joshua.</p>
        <a href="/" className="text-emerald-400 hover:underline text-sm">Go home</a>
      </div>
    )
  }

  const currentGame = games.find(g => g.game_number === selectedGame)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Admin Panel</h1>
        <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">Joshua only</span>
      </div>

      {/* Week Selector */}
      <div className="week-selector">
        {GAMES.map(g => {
          const gameData = games.find(gd => gd.game_number === g.number)
          return (
            <button
              key={g.number}
              onClick={() => setSelectedGame(g.number)}
              className={`week-btn ${selectedGame === g.number ? 'active' : ''}`}
            >
              {g.label}
              {gameData?.forfeited && <span className="ml-1 text-red-400 text-xs">✕</span>}
            </button>
          )
        })}
      </div>

      {currentGame && (
        <>
          {/* Forfeit Toggle */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-200">
                  {GAMES.find(g => g.number === selectedGame)?.label} — Forfeit
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Marks game as forfeited. Zeros all scores for this week.
                </p>
              </div>
              <button
                onClick={() => toggleForfeit(currentGame)}
                disabled={saving}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  currentGame.forfeited
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                    : 'btn-secondary hover:border-red-500/30 hover:text-red-400'
                }`}
              >
                {currentGame.forfeited ? 'Forfeited ✕' : 'Mark Forfeited'}
              </button>
            </div>
          </div>

          {/* Player Availability */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-semibold text-slate-200 mb-1">Player Availability</h2>
            <p className="text-slate-500 text-sm mb-5">
              Toggle players inactive if they're not playing this week.
              Inactive players won't appear in lines, picks, or stats tables.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {PLAYERS.map(player => {
                const isActive = availability[currentGame.id]?.[player] ?? true
                return (
                  <button
                    key={player}
                    onClick={() => togglePlayerAvailability(currentGame.id, player)}
                    className={`px-3 py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400 opacity-70'
                    }`}
                  >
                    <div>{player}</div>
                    <div className="text-xs mt-0.5 font-normal">
                      {isActive ? 'Active' : 'Inactive'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-slate-600 text-xs text-center">
            Changes save instantly. Refresh other pages to see updates.
          </p>
        </>
      )}
    </div>
  )
}
