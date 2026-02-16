'use client'

import { useState, useEffect, useRef } from 'react'
import { BETTORS, Player } from '@/lib/constants'

interface PlayerSelectProps {
  onSelect: (player: Player) => void
  selected?: Player | null
  compact?: boolean
}

export default function PlayerSelect({ onSelect, selected, compact }: PlayerSelectProps) {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(selected || null)
  const [showPicker, setShowPicker] = useState(false)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const saved = localStorage.getItem('jungle_player') as Player | null
    if (saved && BETTORS.includes(saved as Player)) {
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

  if (compact && currentPlayer && !showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
      >
        <span className="capitalize font-medium">{currentPlayer}</span>
        <span className="text-xs text-slate-500">[switch]</span>
      </button>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Select Player</h2>
        {showPicker && currentPlayer && (
          <button
            onClick={() => setShowPicker(false)}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BETTORS.map((player) => (
          <button
            key={player}
            onClick={() => handleSelect(player, compact || false)}
            className={`px-4 py-3 rounded-xl capitalize font-medium text-sm transition-all ${
              currentPlayer === player
                ? 'btn-accent'
                : 'btn-secondary'
            }`}
          >
            {player}
          </button>
        ))}
      </div>
    </div>
  )
}
