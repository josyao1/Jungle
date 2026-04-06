'use client'

/**
 * PlayerSelect — Roster picker component.
 * Shows player photo cards (full-bleed) with name overlay.
 * Photos load from /players/{name}.png only; jay/tommy/neo use initials until photos are added.
 * Compact mode renders as a pill with circular photo for use in nav areas.
 */

import { useState, useEffect, useRef } from 'react'
import { BETTORS, Bettor, Player } from '@/lib/constants'

interface PlayerSelectProps {
  onSelect: (player: Player) => void
  selected?: Player | null
  compact?: boolean
}

// Players who have a photo in /public/players/{name}.png
const PLAYERS_WITH_PHOTOS = new Set([
  'joshua', 'ronit', 'aarnav', 'evan', 'andrew', 'rohit', 'teja', 'aiyan', 'salil', 'Jay', 'Tommy', 'Neo',
])

// Each player gets a fixed hue for avatar ring consistency
const PLAYER_HUES: Record<string, string> = {
  joshua:  '#22c55e',
  ronit:   '#f59e0b',
  aarnav:  '#06b6d4',
  evan:    '#a855f7',
  andrew:  '#f97316',
  rohit:   '#ec4899',
  teja:    '#10b981',
  aiyan:   '#3b82f6',
  salil:   '#eab308',
  Jay:     '#8b5cf6',
  Tommy:   '#84cc16',
  Neo:     '#d946ef',
}

// Full-bleed square photo for the roster grid
function PlayerPhotoSquare({ name, color, isSelected }: { name: string; color: string; isSelected: boolean }) {
  const hasPhoto = PLAYERS_WITH_PHOTOS.has(name)

  if (!hasPhoto) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: isSelected
            ? `radial-gradient(circle at 40% 35%, ${color}25, ${color}08)`
            : 'rgba(6, 11, 8, 0.8)',
          color: isSelected ? color : 'var(--text-muted)',
          fontFamily: "'Bebas Neue', 'Impact', sans-serif",
          fontSize: '1.75rem',
          fontWeight: 900,
          letterSpacing: '0.04em',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={`/players/${name}.png`}
      alt={name}
      className="absolute inset-0 w-full h-full object-cover object-top"
    />
  )
}

// Circular photo for compact pill mode
function PlayerPhotoCircle({ name, color, isSelected }: { name: string; color: string; isSelected: boolean }) {
  const hasPhoto = PLAYERS_WITH_PHOTOS.has(name)

  const ringStyle = {
    border: isSelected ? `2px solid ${color}` : '1.5px solid rgba(34, 197, 94, 0.12)',
    transition: 'border-color 0.18s ease',
  }

  if (!hasPhoto) {
    return (
      <div
        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
        style={{
          ...ringStyle,
          background: isSelected
            ? `radial-gradient(circle at 35% 35%, ${color}30, ${color}10)`
            : `radial-gradient(circle at 35% 35%, rgba(34,197,94,0.08), transparent)`,
          color: isSelected ? color : 'var(--text-muted)',
          fontFamily: "'Bebas Neue', 'Impact', sans-serif",
          fontSize: '1.125rem',
          fontWeight: 900,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden" style={ringStyle}>
      <img
        src={`/players/${name}.png`}
        alt={name}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

// Small circular avatar (with photo or initial)
function PlayerPhotoSmall({ name, color }: { name: string; color: string }) {
  const hasPhoto = PLAYERS_WITH_PHOTOS.has(name)

  if (!hasPhoto) {
    return (
      <div
        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${color}22, ${color}08)`,
          border: `1.5px solid ${color}55`,
          color,
          fontFamily: "'Bebas Neue', 'Impact', sans-serif",
          fontSize: '0.875rem',
          letterSpacing: '0.04em',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className="w-7 h-7 rounded-full shrink-0 overflow-hidden"
      style={{ border: `1.5px solid ${color}55` }}
    >
      <img src={`/players/${name}.png`} alt={name} className="w-full h-full object-cover" />
    </div>
  )
}

export default function PlayerSelect({ onSelect, selected, compact }: PlayerSelectProps) {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(selected || null)
  const [showPicker, setShowPicker] = useState(false)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const saved = localStorage.getItem('jungle_player')
    if (saved && (BETTORS as readonly string[]).includes(saved)) {
      setCurrentPlayer(saved as Player)
      onSelect(saved as Player)
    }
  }, [onSelect])

  const handleSelect = (player: Player, isSwitch: boolean = false) => {
    const changed = player !== currentPlayer
    setCurrentPlayer(player)
    localStorage.setItem('jungle_player', player)
    onSelect(player)
    setShowPicker(false)

    if (isSwitch && changed) {
      window.location.reload()
    }
  }

  /* Compact mode: pill showing current player photo + name + [switch] */
  if (compact && currentPlayer && !showPicker) {
    const color = PLAYER_HUES[currentPlayer] || '#22c55e'
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
        style={{
          background: 'rgba(6, 11, 8, 0.7)',
          border: `1px solid ${color}44`,
        }}
      >
        <PlayerPhotoSmall name={currentPlayer} color={color} />
        <span className="text-sm font-semibold capitalize" style={{ color }}>
          {currentPlayer}
        </span>
        <span
          className="text-xs ml-1"
          style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
        >
          [switch]
        </span>
      </button>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div
            className="text-xs font-bold uppercase tracking-[0.15em] mb-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Roster
          </div>
          <div className="text-sm text-slate-400">Select your name</div>
        </div>
        {showPicker && currentPlayer && (
          <button
            onClick={() => setShowPicker(false)}
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            ✕ Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5" style={{ maxWidth: 320, margin: '0 auto' }}>
        {BETTORS.map((player) => {
          const isSelected = currentPlayer === player
          const color = PLAYER_HUES[player] || '#22c55e'

          return (
            <button
              key={player}
              onClick={() => handleSelect(player, compact || false)}
              className="relative rounded-xl overflow-hidden transition-all"
              style={{
                aspectRatio: '3 / 4',
                border: isSelected ? `2px solid ${color}` : '1.5px solid rgba(34, 197, 94, 0.08)',
                boxShadow: isSelected ? `0 0 20px ${color}30` : 'none',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              {/* Full-bleed photo or initial */}
              <PlayerPhotoSquare name={player} color={color} isSelected={isSelected} />

              {/* Name overlay at bottom */}
              <div
                className="absolute inset-x-0 bottom-0 py-1.5 text-center"
                style={{
                  background: isSelected
                    ? `linear-gradient(to top, ${color}50, transparent)`
                    : 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                }}
              >
                <span
                  className="text-xs font-bold capitalize leading-none"
                  style={{
                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.75)',
                    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem',
                  }}
                >
                  {player}
                </span>
              </div>

              {/* Selected top glow stripe */}
              {isSelected && (
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
