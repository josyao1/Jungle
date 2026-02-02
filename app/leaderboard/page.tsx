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
    // Get all games with their IDs
    const { data: games } = await supabase
      .from('games')
      .select('id, game_number')
      .order('game_number')

    if (!games) {
      setLoading(false)
      return
    }

    const gameMap = new Map(games.map(g => [g.id, g.game_number]))

    // Get all scores
    const { data: allScores } = await supabase
      .from('scores')
      .select('*')

    // Aggregate by player
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

    // Sort by total points
    const sorted = Array.from(playerScores.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)

    setScores(sorted)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-center text-sm">Hits</th>
              <th className="px-4 py-3 text-center text-sm">Misses</th>
              <th className="px-4 py-3 text-center text-sm">Exact</th>
              <th className="px-4 py-3 text-center text-sm">Props</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((entry, i) => (
              <>
                <tr
                  key={entry.player}
                  className={`border-t border-gray-700 cursor-pointer hover:bg-gray-700/50 ${
                    expandedPlayer === entry.player ? 'bg-gray-700/50' : ''
                  }`}
                  onClick={() => setExpandedPlayer(
                    expandedPlayer === entry.player ? null : entry.player
                  )}
                >
                  <td className="px-4 py-3">
                    <span className={i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : ''}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize font-medium">
                    {entry.player}
                    {i === 0 && ' 👑'}
                  </td>
                  <td className="px-4 py-3 text-center text-green-400">
                    {entry.totalCorrectPicks}
                  </td>
                  <td className="px-4 py-3 text-center text-red-400">
                    {entry.totalMissedPicks + entry.totalPropMisses}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {entry.totalExactLines}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {entry.totalPropWins}/{entry.totalPropWins + entry.totalPropMisses}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">
                    {entry.totalPoints}
                  </td>
                </tr>
                {expandedPlayer === entry.player && entry.games.length > 0 && (
                  <tr key={`${entry.player}-expanded`}>
                    <td colSpan={6} className="px-4 py-3 bg-gray-900">
                      <div className="text-sm">
                        <div className="font-medium mb-2 text-gray-400">Game Breakdown</div>
                        <div className="grid grid-cols-4 gap-2">
                          {GAMES.map(g => {
                            const gameScore = entry.games.find(gs => gs.game_number === g.number)
                            return (
                              <div
                                key={g.number}
                                className="bg-gray-800 rounded p-2"
                              >
                                <div className="text-xs text-gray-500 mb-1">Game {g.number}</div>
                                {gameScore ? (
                                  <>
                                    <div className="text-green-400 font-medium">
                                      {gameScore.total_points} pts
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {gameScore.correct_picks}✓ {gameScore.missed_picks + gameScore.prop_misses}✗ / {gameScore.exact_lines} exact / {gameScore.prop_wins} props
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-gray-500">-</div>
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

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Scoring Rules</h2>
        <ul className="text-gray-400 text-sm space-y-1">
          <li><span className="text-green-400">+1</span> for each correct over pick</li>
          <li><span className="text-red-400">-0.5</span> for each missed over pick</li>
          <li><span className="text-green-400">+1</span> bonus for predicting exact stat value</li>
          <li><span className="text-green-400">+1</span> for each correct prop bet</li>
          <li><span className="text-red-400">-0.5</span> for each wrong prop bet</li>
        </ul>
      </div>
    </div>
  )
}
