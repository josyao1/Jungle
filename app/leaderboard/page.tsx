'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { PLAYERS, GAMES, Player } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

interface GameScore {
  game_number: number
  correct_picks: number
  missed_picks: number
  exact_lines: number
  prop_wins: number
  prop_misses: number
  total_points: number
}

interface PlayerScores {
  player: string
  totalPoints: number
  totalCorrectPicks: number
  totalMissedPicks: number
  totalExactLines: number
  totalPropWins: number
  totalPropMisses: number
  games: GameScore[]
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<PlayerScores[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: games } = await supabase
      .from('games')
      .select('id, game_number')
      .order('game_number')

    if (!games) {
      setLoading(false)
      return
    }

    const gameMap = new Map(games.map(g => [g.id, g.game_number]))

    const { data: allScores } = await supabase
      .from('scores')
      .select('*')

    const playerScores = new Map<string, PlayerScores>()

    PLAYERS.forEach(p => {
      playerScores.set(p, {
        player: p,
        totalPoints: 0,
        totalCorrectPicks: 0,
        totalMissedPicks: 0,
        totalExactLines: 0,
        totalPropWins: 0,
        totalPropMisses: 0,
        games: [],
      })
    })

    if (allScores) {
      allScores.forEach(score => {
        const playerData = playerScores.get(score.player)
        if (!playerData) return

        const gameNum = gameMap.get(score.game_id)
        if (!gameNum) return

        playerData.totalPoints += score.total_points || 0
        playerData.totalCorrectPicks += score.correct_picks || 0
        playerData.totalMissedPicks += score.missed_picks || 0
        playerData.totalExactLines += score.exact_lines || 0
        playerData.totalPropWins += score.prop_wins || 0
        playerData.totalPropMisses += score.prop_misses || 0
        playerData.games.push({
          game_number: gameNum,
          correct_picks: score.correct_picks || 0,
          missed_picks: score.missed_picks || 0,
          exact_lines: score.exact_lines || 0,
          prop_wins: score.prop_wins || 0,
          prop_misses: score.prop_misses || 0,
          total_points: score.total_points || 0,
        })
      })
    }

    const sorted = Array.from(playerScores.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)

    setScores(sorted)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading...</div>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl md:text-2xl font-bold text-center">Leaderboard</h1>

      <div className="glass-card rounded-2xl overflow-x-auto mobile-scroll">
        <table className="glass-table">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="text-center w-12">#</th>
              <th>Player</th>
              <th className="text-center">Hits</th>
              <th className="text-center">Miss</th>
              <th className="text-center">Exact</th>
              <th className="text-center">Props</th>
              <th className="text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((entry, i) => (
              <>
                <tr
                  key={entry.player}
                  className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpandedPlayer(
                    expandedPlayer === entry.player ? null : entry.player
                  )}
                >
                  <td className="text-center">
                    <span className={`font-bold ${
                      i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="capitalize font-medium">
                    {entry.player}
                  </td>
                  <td className="text-center stat-positive font-medium">
                    {entry.totalCorrectPicks}
                  </td>
                  <td className="text-center stat-negative font-medium">
                    {entry.totalMissedPicks + entry.totalPropMisses}
                  </td>
                  <td className="text-center text-slate-500">
                    {entry.totalExactLines}
                  </td>
                  <td className="text-center text-slate-500">
                    {entry.totalPropWins}
                  </td>
                  <td className="text-right">
                    <span className={`font-bold text-lg ${i === 0 ? 'stat-value' : 'text-slate-400'}`}>
                      {entry.totalPoints}
                    </span>
                  </td>
                </tr>
                {expandedPlayer === entry.player && entry.games.length > 0 && (
                  <tr key={`${entry.player}-expanded`}>
                    <td colSpan={7} className="bg-white/[0.02] px-3 md:px-6 py-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Game Breakdown
                      </div>
                      <div className="overflow-x-auto mobile-scroll -mx-3 px-3 md:mx-0 md:px-0">
                        <div className="flex md:grid md:grid-cols-4 gap-3 min-w-max md:min-w-0">
                          {GAMES.map(g => {
                            const gameScore = entry.games.find(gs => gs.game_number === g.number)
                            return (
                              <div key={g.number} className="glass-card rounded-xl p-3 md:p-4 w-28 md:w-auto flex-shrink-0 md:flex-shrink">
                                <div className="text-xs text-slate-500 mb-2">Week {g.number}</div>
                                {gameScore ? (
                                  <>
                                    <div className="text-lg md:text-xl font-bold stat-value">{gameScore.total_points}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      <span className="stat-positive">{gameScore.correct_picks}W</span>
                                      {' '}
                                      <span className="stat-negative">{gameScore.missed_picks}L</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-600">—</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Scoring</h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Correct Over</span>
            <span className="stat-positive font-medium">+1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Missed Over</span>
            <span className="stat-negative font-medium">-0.5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Exact Line</span>
            <span className="stat-value font-medium">+1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Correct Prop</span>
            <span className="stat-value font-medium">+1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
