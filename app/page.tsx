'use client'

export const dynamic = 'force-dynamic'

/**
 * Home page — player selection, game status, and quick-nav buttons.
 * Player selection persists to localStorage as 'jungle_player'.
 */

import { useState } from 'react'
import PlayerSelect from '@/components/PlayerSelect'
import GameStatus from '@/components/GameStatus'
import { Player } from '@/lib/constants'

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
          <div className="grid grid-cols-3 gap-3">
            <a href="/pick"
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-2xl">🎯</span>
              <span className="text-sm font-semibold text-slate-300">Pick Overs</span>
            </a>
            <a href="/stats"
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-2xl">📊</span>
              <span className="text-sm font-semibold text-slate-300">Stats</span>
            </a>
            <a href="/leaderboard"
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-2xl">🏆</span>
              <span className="text-sm font-semibold text-slate-300">Board</span>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
