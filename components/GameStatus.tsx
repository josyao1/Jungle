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

  const game = gameNumber
    ? GAMES.find(g => g.number === gameNumber)
    : GAMES.find(g => {
        const nextMorning = new Date(g.date)
        nextMorning.setDate(nextMorning.getDate() + 1)
        nextMorning.setUTCHours(14, 0, 0, 0)
        return now < nextMorning
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
        label: 'OPEN',
        sublabel: formatTimeRemaining(game.lockTime),
        badgeClass: 'badge-open',
        action: '/set-lines',
        actionLabel: 'Set Lines',
      }
    } else {
      return {
        label: 'LOCKED',
        sublabel: 'Final',
        badgeClass: 'badge-locked',
        action: '/results',
        actionLabel: 'Results',
      }
    }
  }

  const info = getPhaseInfo()

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">
            {gameDate} • 5:00 PM
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">Game {game.number}</span>
            <span className={`badge ${info.badgeClass}`}>{info.label}</span>
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {phase === 'open' ? `Locks in ${info.sublabel}` : info.sublabel}
          </div>
        </div>
        <a
          href={info.action}
          className="btn-accent px-6 py-3 rounded-xl text-sm font-semibold"
        >
          {info.actionLabel}
        </a>
      </div>
    </div>
  )
}
