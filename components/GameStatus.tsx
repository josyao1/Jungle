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
  const isOpen = phase === 'open'

  const gameDate = game.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  const timeRemaining = formatTimeRemaining(game.lockTime)

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden"
      style={{ position: 'relative' }}
    >
      {/* Ambient glow stripe at top */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: isOpen
            ? 'linear-gradient(90deg, transparent, rgba(34,197,94,0.5), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)',
        }}
      />

      <div className="p-5 flex items-stretch gap-4">
        {/* Left: Status block */}
        <div
          className="flex flex-col items-center justify-center px-4 rounded-xl min-w-[72px]"
          style={{
            background: isOpen ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.07)',
            border: isOpen ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.18)',
          }}
        >
          <span
            className="text-2xl font-black leading-none"
            style={{
              fontFamily: "'Bebas Neue', 'Impact', sans-serif",
              letterSpacing: '0.06em',
              color: isOpen ? '#22c55e' : '#f87171',
            }}
          >
            {isOpen ? 'OPEN' : 'LOCK'}
          </span>
          <div
            className="w-1.5 h-1.5 rounded-full mt-1"
            style={{
              background: isOpen ? '#22c55e' : '#f87171',
              boxShadow: isOpen ? '0 0 6px #22c55e' : '0 0 6px #f87171',
              animation: isOpen ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Center: Game info */}
        <div className="flex-1 min-w-0">
          <div
            className="text-xs uppercase tracking-[0.12em] mb-1"
            style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {game.label} · {gameDate}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-2xl font-black leading-none"
              style={{ fontFamily: "'Bebas Neue', 'Impact', sans-serif", letterSpacing: '0.04em' }}
            >
              3:00 PM
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sunday · CDT</span>
          </div>

          {isOpen ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Locks in</span>
              <span
                className="font-bold text-sm"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b' }}
              >
                {timeRemaining}
              </span>
            </div>
          ) : (
            <div
              className="mt-1.5 text-xs uppercase tracking-widest font-semibold"
              style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Picks locked · Results pending
            </div>
          )}
        </div>

        {/* Right: CTA */}
        <div className="flex items-center shrink-0">
          <a
            href={isOpen ? '/set-lines' : '/results'}
            className="btn-accent px-4 py-2.5 rounded-xl text-xs font-bold"
            style={{ letterSpacing: '0.06em' }}
          >
            {isOpen ? 'Set Lines' : 'Results'}
          </a>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
