'use client'

import { useState, useEffect } from 'react'
import { GAMES, getGamePhase } from '@/lib/constants'
import { formatTimeRemaining } from '@/lib/utils'

interface GameStatusProps {
  gameNumber?: number
}

export default function GameStatus({ gameNumber }: GameStatusProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Find current/next game
  const game = gameNumber
    ? GAMES.find(g => g.number === gameNumber)
    : GAMES.find(g => {
        const gameEnd = new Date(g.date.getTime() + 3 * 60 * 60 * 1000)
        return now < gameEnd
      }) || GAMES[GAMES.length - 1]

  if (!game) return null

  const phase = getGamePhase(game)
  const gameDate = game.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const getPhaseInfo = () => {
    if (phase === 'open') {
      return {
        label: 'Open',
        sublabel: `Locks in ${formatTimeRemaining(game.lockTime)}`,
        color: 'text-green-400',
        action: '/set-lines',
        actionLabel: 'Set Lines & Pick',
      }
    } else {
      return {
        label: 'Locked',
        sublabel: 'Enter results when done',
        color: 'text-blue-400',
        action: '/results',
        actionLabel: 'Enter Results',
      }
    }
  }

  const info = getPhaseInfo()

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Game {game.number}</h2>
        <span className="text-gray-400 text-sm">{gameDate} @ 5pm</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <span className={`font-medium ${info.color}`}>{info.label}</span>
          <p className="text-gray-400 text-sm">{info.sublabel}</p>
        </div>
        <a
          href={info.action}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
        >
          {info.actionLabel}
        </a>
      </div>
    </div>
  )
}
