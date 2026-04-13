import { PLAYER_HUES, PLAYERS_WITH_PHOTOS } from '@/lib/constants'

interface PlayerAvatarProps {
  player: string
  /** Diameter in px. Defaults to 28 (Tailwind w-7). */
  size?: number
  /** Anchor photo to top — useful for headshots where the face is near the top. */
  objectTop?: boolean
}

export default function PlayerAvatar({ player, size = 28, objectTop = false }: PlayerAvatarProps) {
  const color = PLAYER_HUES[player] || '#22c55e'
  const hasPhoto = PLAYERS_WITH_PHOTOS.has(player)

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, background: hasPhoto ? undefined : `${color}18`, border: `1.5px solid ${color}40` }}
    >
      {hasPhoto ? (
        <img
          src={`/players/${player.toLowerCase()}.png`}
          alt={player}
          className={`w-full h-full object-cover${objectTop ? ' object-top' : ''}`}
        />
      ) : (
        <span style={{ color, fontSize: size * 0.43, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
          {player.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}
