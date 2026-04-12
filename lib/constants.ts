/**
 * constants.ts — Game configuration for the Jungle Softball Sportsbook.
 *
 * Defines:
 *  - PLAYERS / BETTORS: All 9 players (everyone bets on everyone)
 *  - STATS: Softball stat categories tracked per game
 *  - GAMES: 3-week season schedule (Sundays at 3pm CDT starting Apr 12, 2026)
 *  - Helper functions for game phase and current game detection
 *
 * Player availability (injuries/absences) is managed dynamically in the
 * `player_availability` Supabase table, not hardcoded here.
 */

// Player avatar hue — used for left-border accents and initial avatars.
// Add an entry here when a new player joins.
export const PLAYER_HUES: Record<string, string> = {
  joshua: '#22c55e', ronit: '#f59e0b', aarnav: '#06b6d4', evan: '#a855f7',
  andrew: '#f97316', rohit: '#ec4899', teja: '#10b981', aiyan: '#3b82f6',
  salil: '#eab308', Jay: '#8b5cf6', Tommy: '#84cc16', Neo: '#d946ef',
  Alan: '#64748b', Reis: '#f43f5e',
}

// Players with a photo at /public/players/{name.toLowerCase()}.png
// Add to this set when a new player provides a photo.
export const PLAYERS_WITH_PHOTOS = new Set<string>([
  'joshua', 'ronit', 'aarnav', 'evan', 'andrew', 'rohit', 'teja', 'aiyan', 'salil', 'Jay', 'Tommy', 'Neo',
])

// Bettors — the core group who can place picks (does NOT include week-1-only guests)
export const BETTORS = ['joshua', 'ronit', 'aarnav', 'evan', 'andrew', 'rohit', 'teja', 'aiyan', 'salil', 'Jay', 'Tommy', 'Neo'] as const
export type Bettor = typeof BETTORS[number]

// All players including week-1-only guests (Alan, Reis)
export const PLAYERS = ['joshua', 'ronit', 'aarnav', 'evan', 'andrew', 'rohit', 'teja', 'aiyan', 'salil', 'Jay', 'Tommy', 'Neo', 'Alan', 'Reis'] as const
export type Player = typeof PLAYERS[number]

// Players who only appear in game 1 (no betting profile, stats week 1 only)
export const WEEK1_ONLY_PLAYERS = new Set<string>(['Alan', 'Reis'])

// Returns the players eligible for a given game number.
export function getPlayersForGame(gameNumber: number): readonly string[] {
  if (gameNumber === 1) return PLAYERS
  return PLAYERS.filter(p => !WEEK1_ONLY_PLAYERS.has(p))
}

// All players are on roster for all games (no IR system to start)
export function isPlayerOnRoster(_player: Player, _gameNumber: number): boolean {
  return true
}

export function isPlayerInjured(_player: Player, _gameNumber?: number): boolean {
  return false
}

export function getActivePlayersForGame(_gameNumber: number): readonly Player[] {
  return PLAYERS
}

export function getRosterForGame(_gameNumber: number): readonly Player[] {
  return PLAYERS
}

export const ACTIVE_PLAYERS = PLAYERS

// Softball stats
export const STATS = ['hits', 'rbis', 'totalbases', 'errors', 'strikeouts'] as const

// Prop bets — one per game, no exact line scoring, just pick the player
export const PROP_BETS = ['biggest_disaster', 'longest_hit'] as const
export type PropBet = typeof PROP_BETS[number]

export const PROP_BET_LABELS: Record<PropBet, string> = {
  biggest_disaster: '🤦 Biggest Disaster Moment',
  longest_hit: '💥 Longest Hit',
}
export type Stat = typeof STATS[number]

export const STAT_LABELS: Record<Stat, string> = {
  hits: 'Hits',
  rbis: 'RBIs',
  totalbases: 'Total Bases',
  errors: 'Errors',
  strikeouts: 'Ks (throw)',
}

// Game dates - Sundays at 3pm CDT (UTC-5 = 20:00 UTC) starting April 12
export const GAMES = [
  {
    number: 1,
    label: 'Week 1',
    date: new Date('2026-04-12T20:00:00Z'), // Apr 12 at 3pm CDT
    lockTime: new Date('2026-04-12T20:00:00Z'),
    opponent: 'UV Catastrophe',
    home: true,
  },
  {
    number: 2,
    label: 'Week 2',
    date: new Date('2026-04-19T20:00:00Z'), // Apr 19
    lockTime: new Date('2026-04-19T20:00:00Z'),
    opponent: 'Bob Nighten-Gales',
    home: false,
  },
  {
    number: 3,
    label: 'Week 3',
    date: new Date('2026-04-26T20:00:00Z'), // Apr 26
    lockTime: new Date('2026-04-26T20:00:00Z'),
    opponent: 'INOBLACKIDOMINICAN',
    home: true,
  },
]

// Sort players so inactive ones always appear at the bottom.
// Accepts Set<string> or Map<string, any> (both have .has()).
export function sortWithInactiveAtBottom(players: readonly string[], inactive: { has(p: string): boolean }): string[] {
  return [...players].sort((a, b) => {
    const aOut = inactive.has(a) ? 1 : 0
    const bOut = inactive.has(b) ? 1 : 0
    return aOut - bOut
  })
}

export function getCurrentGame() {
  const now = new Date()
  for (const game of GAMES) {
    // Game is still relevant until 8am the next morning CST
    const nextMorning = new Date(game.date)
    nextMorning.setDate(nextMorning.getDate() + 1)
    nextMorning.setUTCHours(13, 0, 0, 0) // 8am CDT = 13:00 UTC

    if (now < nextMorning) {
      return game
    }
  }
  return GAMES[GAMES.length - 1]
}

export function getGamePhase(game: typeof GAMES[number]) {
  const now = new Date()
  if (now < game.lockTime) {
    return 'open'
  } else {
    return 'locked'
  }
}
