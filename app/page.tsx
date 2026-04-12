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
        </h1>
        <p className="text-slate-500 text-sm">IM Softball Sportsbook · Spring 2026</p>
      </div>

      {/* Season Schedule */}
      <div className="glass-card rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Season Schedule</h2>
        <div className="overflow-x-auto mobile-scroll -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex md:grid md:grid-cols-4 gap-2 min-w-max md:min-w-0">
          {GAMES.map(g => {
            const dateLabel: Record<number, string> = { 1: 'Apr 12', 2: 'Apr 19', 3: 'Apr 26' }
            const isHome = g.home
            return (
              <div key={g.number}
                className="rounded-xl p-2.5 text-center w-32 flex-shrink-0 md:w-auto md:flex-shrink"
                style={{
                  background: isHome ? 'rgba(168,85,247,0.12)' : 'rgba(248,250,252,0.06)',
                  border: isHome ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(248,250,252,0.18)',
                }}
              >
                <div className="text-xs mb-0.5" style={{ color: isHome ? 'rgba(192,132,252,0.7)' : 'rgba(148,163,184,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {dateLabel[g.number]}
                </div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: isHome ? '#c084fc' : '#f1f5f9' }}>{g.label}</div>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: isHome ? 'rgba(192,132,252,0.55)' : 'rgba(241,245,249,0.4)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem' }}>
                  {isHome ? 'HOME' : 'AWAY'}
                </div>
                <div className="font-medium leading-tight" style={{ color: isHome ? '#d8b4fe' : '#e2e8f0', fontSize: '0.6rem' }}>
                  vs. {g.opponent}
                </div>
                {'finalScore' in g && g.finalScore && (
                  <div className="mt-1.5 rounded-lg px-2 py-0.5 inline-block"
                    style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.45)' }}>
                    <span style={{ color: '#4ade80', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.85rem', letterSpacing: '0.08em' }}>
                      W {g.finalScore}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Playoff Week 1 */}
          <div className="rounded-xl p-2.5 text-center w-32 flex-shrink-0 md:w-auto md:flex-shrink" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div className="text-xs mb-0.5" style={{ color: 'rgba(245,158,11,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>TBD</div>
            <div className="text-xs font-semibold mb-0.5" style={{ color: '#f59e0b' }}>Playoffs</div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(245,158,11,0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem' }}>Week 1</div>
            <div className="font-bold" style={{ color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.03em', lineHeight: 1.4 }}>
              WE WILL BE MAKING THE PLAYOFFS
            </div>
          </div>
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
