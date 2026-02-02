'use client'

import { useState, useEffect, useRef } from 'react'
import { PLAYERS, Player } from '@/lib/constants'

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
    // Load from localStorage on mount (only once)
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const saved = localStorage.getItem('jungle_player') as Player | null
    if (saved && PLAYERS.includes(saved as Player)) {
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

    // Only reload if user actively switched players
    if (isSwitch && changed) {
      window.location.reload()
    }
  }

  // Compact mode - just shows current player with switch button
  if (compact && currentPlayer && !showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
      >
        <span className="capitalize">{currentPlayer}</span>
        <span className="text-xs">(switch)</span>
      </button>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Who are you?</h2>
        {showPicker && currentPlayer && (
          <button
            onClick={() => setShowPicker(false)}
            className="text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PLAYERS.map((player) => (
          <button
            key={player}
            onClick={() => handleSelect(player, compact || false)}
            className={`px-4 py-2 rounded-lg capitalize transition-colors ${
              currentPlayer === player
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {player}
          </button>
        ))}
      </div>
    </div>
  )
}
