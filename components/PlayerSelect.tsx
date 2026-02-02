'use client'

import { useState, useEffect } from 'react'
import { PLAYERS, Player } from '@/lib/constants'

interface PlayerSelectProps {
  onSelect: (player: Player) => void
  selected?: Player | null
}

export default function PlayerSelect({ onSelect, selected }: PlayerSelectProps) {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(selected || null)

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('jungle_player') as Player | null
    if (saved && PLAYERS.includes(saved as Player)) {
      setCurrentPlayer(saved as Player)
      onSelect(saved as Player)
    }
  }, [onSelect])

  const handleSelect = (player: Player) => {
    setCurrentPlayer(player)
    localStorage.setItem('jungle_player', player)
    onSelect(player)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">Who are you?</h2>
      <div className="grid grid-cols-3 gap-2">
        {PLAYERS.map((player) => (
          <button
            key={player}
            onClick={() => handleSelect(player)}
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
