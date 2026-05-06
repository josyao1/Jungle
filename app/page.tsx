'use client'

export const dynamic = 'force-dynamic'

/**
 * Home page — player selection, game status, and quick-nav buttons.
 * Player selection persists to localStorage as 'jungle_player'.
 */

import { useState } from 'react'
import PlayerSelect from '@/components/PlayerSelect'
import GameStatus from '@/components/GameStatus'
import { Player, GAMES } from '@/lib/constants'

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null)

  return (
    <div className="space-y-8">
      <div className="text-center mb-10">
        <div className="text-xs font-semibold tracking-[0.3em] uppercase text-slate-500 mb-2">Softball Season</div>
        <h1 className="text-5xl font-black tracking-tight mb-2 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/headshot.png" alt="Jungle" className="w-12 h-12 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 16px rgba(34,197,94,0.15)' }} />
          <span className="text-gradient-brand">JUNGLE</span>
          <span className="text-base font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(148,163,184,0.7)', letterSpacing: '0.05em' }}>1-1</span>
        </h1>
        <p className="text-slate-500 text-sm">IM Softball Sportsbook · Spring 2026</p>
      </div>

      {/* Season Schedule */}
      <div className="glass-card rounded-2xl px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Season Schedule</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max md:min-w-0">
            {GAMES.map(g => {
              const isHome = g.home
              const dateLabel = g.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
              const score = 'finalScore' in g ? g.finalScore : undefined
              const result = 'result' in g ? g.result : undefined
              const isWin = result === 'W'
              return (
                <div key={g.number} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: isHome ? 'rgba(168,85,247,0.08)' : 'rgba(248,250,252,0.04)',
                    border: isHome ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <span className="text-xs shrink-0" style={{ color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{dateLabel}</span>
                  <span className="text-xs font-semibold" style={{ color: isHome ? '#c084fc' : '#94a3b8' }}>{g.label}</span>
                  {score
                    ? <span className="text-xs font-bold shrink-0" style={{ color: isWin ? '#4ade80' : '#f87171', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>{result} {score}</span>
                    : <span className="text-xs" style={{ color: '#475569' }}>vs. {g.opponent}</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>How It Works</h2>
        <div className="flex gap-3 items-start">
          <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>1</span>
          <p className="text-sm text-slate-400"><span className="text-slate-200 font-medium">Set Lines</span> — Predict each player's stats. <span className="text-slate-300">This is NOT picking over/under</span> — everyone's predictions average together into the official line.</p>
        </div>
        <div className="flex gap-3 items-start">
          <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>2</span>
          <p className="text-sm text-slate-400"><span className="text-slate-200 font-medium">Pick Overs</span> — Bet the over on any lines you like. Hit = +1 pt, miss = −0.5 pts.</p>
        </div>
      </div>

      <PlayerSelect onSelect={setPlayer} selected={player} />

      {player && (
        <>
          <GameStatus />

          {/* Quick nav */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { href: '/pick',        label: 'PICKS',  sub: 'Bet the over',  color: '#22c55e' },
              { href: '/stats',       label: 'STATS',  sub: 'Season data',   color: '#f59e0b' },
              { href: '/leaderboard', label: 'BOARD',  sub: 'Rankings',      color: '#a855f7' },
            ] as const).map(({ href, label, sub, color }) => (
              <a key={href} href={href}
                className="group rounded-xl px-3 py-4 flex flex-col justify-between transition-all"
                style={{
                  background: 'rgba(6,11,8,0.6)',
                  border: `1px solid ${color}18`,
                  borderLeft: `3px solid ${color}`,
                  minHeight: '80px',
                }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color,
                  lineHeight: 1,
                }}>
                  {label}
                </span>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-slate-600 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {sub}
                  </span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5"
                    style={{ color, opacity: 0.6 }}>→</span>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
