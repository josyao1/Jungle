'use client'

export const dynamic = 'force-dynamic'

/**
 * Leaderboard page — Compact ranked player list with expandable per-week breakdown.
 */

import { useState, useEffect, useCallback } from 'react'
import { BETTORS, GAMES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface GameScore {
  game_number: number
  correct_picks: number
  missed_picks: number
  total_points: number
}

interface PlayerScores {
  player: string
  totalPoints: number
  totalCorrectPicks: number
  totalMissedPicks: number
  games: GameScore[]
}

const PLAYER_HUES: Record<string, string> = {
  joshua:'#22c55e', ronit:'#f59e0b', aarnav:'#06b6d4', evan:'#a855f7',
  andrew:'#f97316', rohit:'#ec4899', teja:'#10b981', aiyan:'#3b82f6',
  salil:'#eab308', Jay:'#8b5cf6', Tommy:'#84cc16', Neo:'#d946ef',
}

const PLAYERS_WITH_PHOTOS = new Set([
  'joshua','ronit','aarnav','evan','andrew','rohit','teja','aiyan','salil','Jay','Tommy','Neo',
])

const RANK_STYLES = [
  { label: '1', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b' },
  { label: '2', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', text: '#94a3b8' },
  { label: '3', bg: 'rgba(205,127,50,0.12)', border: 'rgba(205,127,50,0.3)', text: '#cd7f32' },
]

function PlayerAvatar({ name }: { name: string }) {
  const color = PLAYER_HUES[name] || '#22c55e'
  const hasPhoto = PLAYERS_WITH_PHOTOS.has(name)

  if (hasPhoto) {
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0"
        style={{ border: `1.5px solid ${color}55` }}>
        <img src={`/players/${name.toLowerCase()}.png`} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 35% 35%, ${color}22, ${color}08)`,
        border: `1.5px solid ${color}55`,
        color,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '1rem',
        letterSpacing: '0.04em',
      }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<PlayerScores[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: games } = await supabase
      .from('jungle_games').select('id, game_number').order('game_number')
    if (!games) { setLoading(false); return }

    const gameMap = new Map(games.map(g => [g.id, g.game_number]))
    const { data: allScores } = await supabase.from('jungle_scores').select('*')

    const playerScores = new Map<string, PlayerScores>()
    BETTORS.forEach(p => playerScores.set(p, {
      player: p, totalPoints: 0, totalCorrectPicks: 0, totalMissedPicks: 0, games: [],
    }))

    allScores?.forEach(score => {
      const playerData = playerScores.get(score.player)
      if (!playerData) return
      const gameNum = gameMap.get(score.game_id)
      if (!gameNum) return
      playerData.totalPoints += score.total_points || 0
      playerData.totalCorrectPicks += score.correct_picks || 0
      playerData.totalMissedPicks += score.missed_picks || 0
      playerData.games.push({
        game_number: gameNum,
        correct_picks: score.correct_picks || 0,
        missed_picks: score.missed_picks || 0,
        total_points: score.total_points || 0,
      })
    })

    setScores(Array.from(playerScores.values()).sort((a, b) => b.totalPoints - a.totalPoints))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-center">Leaderboard</h1>

      <div className="space-y-2">
        {scores.map((entry, i) => {
          const rank = RANK_STYLES[i]
          const color = PLAYER_HUES[entry.player] || '#22c55e'
          const isExpanded = expandedPlayer === entry.player

          return (
            <div key={entry.player}>
              {/* Main row */}
              <button
                className="w-full glass-card rounded-2xl px-4 py-3 flex items-center gap-3 transition-all text-left"
                style={rank ? { border: `1px solid ${rank.border}`, background: rank.bg } : undefined}
                onClick={() => setExpandedPlayer(isExpanded ? null : entry.player)}
              >
                {/* Rank */}
                <div className="w-6 text-center shrink-0">
                  <span className="font-black text-base" style={{ color: rank?.text || 'var(--text-faint)' }}>
                    {i + 1}
                  </span>
                </div>

                {/* Avatar */}
                <PlayerAvatar name={entry.player} />

                {/* Name */}
                <span className="flex-1 font-semibold capitalize text-sm text-slate-200">
                  {entry.player}
                </span>

                {/* Hit / Miss chips */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>
                    +{entry.totalCorrectPicks}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>
                    -{entry.totalMissedPicks}
                  </span>
                </div>

                {/* Points */}
                <div className="w-12 text-right shrink-0">
                  <span className="font-black text-lg"
                    style={{ color: rank ? rank.text : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.totalPoints}
                  </span>
                </div>

                {/* Expand caret */}
                <span className="text-slate-600 text-xs shrink-0 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                  ▾
                </span>
              </button>

              {/* Expanded game breakdown */}
              {isExpanded && (
                <div className="mt-1 px-1">
                  <div className="grid grid-cols-5 gap-1.5">
                    {GAMES.map(g => {
                      const gs = entry.games.find(s => s.game_number === g.number)
                      return (
                        <div key={g.number}
                          className="rounded-xl p-2.5 text-center"
                          style={{ background: 'rgba(6,11,8,0.7)', border: '1px solid rgba(34,197,94,0.07)' }}>
                          <div className="text-slate-600 text-xs mb-1"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            W{g.number}
                          </div>
                          {gs ? (
                            <>
                              <div className="font-black text-base"
                                style={{ color: 'var(--amber-warm)', fontFamily: "'JetBrains Mono', monospace" }}>
                                {gs.total_points > 0 ? `+${gs.total_points}` : gs.total_points}
                              </div>
                              <div className="text-xs mt-0.5 flex justify-center gap-1">
                                <span style={{ color: '#22c55e' }}>{gs.correct_picks}✓</span>
                                <span style={{ color: '#f87171' }}>{gs.missed_picks}✗</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-700 text-sm">—</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scoring key */}
      <div className="flex justify-center gap-6 text-xs"
        style={{ color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
        <span><span style={{ color: '#22c55e' }}>+1</span> correct</span>
        <span><span style={{ color: '#f87171' }}>−0.5</span> missed</span>
      </div>
    </div>
  )
}
