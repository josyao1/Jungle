// Bettors - people who log in, set lines, and make picks
export const BETTORS = ['andy', 'andrew', 'josh', 'ronit', 'aarnav', 'pranav', 'vishi'] as const
export type Bettor = typeof BETTORS[number]

// All players whose stats can be tracked (bettors + non-betting teammates)
export const PLAYERS = ['andy', 'andrew', 'josh', 'ronit', 'aarnav', 'pranav', 'tyler', 'vishi'] as const
export type Player = typeof PLAYERS[number]

// Check if a player is on the game roster (their stats appear in tables)
// Andrew: on roster for all games (but injured from week 3)
// Tyler: on roster for weeks 3 and 4 only
// Vishi: on roster for week 3 only
export function isPlayerOnRoster(player: Player, gameNumber: number): boolean {
  if (player === 'tyler') return gameNumber === 3 || gameNumber === 4
  if (player === 'vishi') return gameNumber === 3
  return true
}

// Check if a player is injured (on IR) for a given game
// Andrew went on IR starting week 3
export function isPlayerInjured(player: Player, gameNumber?: number): boolean {
  if (player === 'andrew') {
    if (gameNumber !== undefined) return gameNumber >= 3
    return true // default to injured if no game specified (for standings etc.)
  }
  return false
}

// Get players who are active (on roster and not injured) for a given game
export function getActivePlayersForGame(gameNumber: number): readonly Player[] {
  return PLAYERS.filter(p => isPlayerOnRoster(p, gameNumber) && !isPlayerInjured(p, gameNumber))
}

// Get players who should appear in stat tables for a given game (on roster, including injured)
export function getRosterForGame(gameNumber: number): readonly Player[] {
  return PLAYERS.filter(p => isPlayerOnRoster(p, gameNumber))
}

// Legacy: Active players for current context (excludes all currently injured)
export const ACTIVE_PLAYERS = PLAYERS.filter(p => !isPlayerInjured(p))

export const STATS = ['pts', '3pm', 'ast', 'stl', 'blk'] as const
export type Stat = typeof STATS[number]

export const STAT_LABELS: Record<Stat, string> = {
  pts: 'Points',
  '3pm': '3-Pointers',
  ast: 'Assists',
  stl: 'Steals',
  blk: 'Blocks',
}

// Prop bets - automatically set up for each game
export const PROP_BETS = ['most_missed_ft', 'team_mvp'] as const
export type PropBet = typeof PROP_BETS[number]

export const PROP_BET_LABELS: Record<PropBet, string> = {
  most_missed_ft: 'Most Missed FTs',
  team_mvp: 'Team MVP',
}

// Game dates - all at 5pm CST (UTC-6 = 11pm UTC)
// Everything locks at 5pm CST when the game starts
export const GAMES = [
  {
    number: 1,
    label: 'Week 1',
    date: new Date('2026-02-02T23:00:00Z'), // Feb 2 at 5pm CST
    lockTime: new Date('2026-02-02T23:00:00Z'), // 5pm CST - lines & picks lock
  },
  {
    number: 2,
    label: 'Week 2',
    date: new Date('2026-02-09T23:00:00Z'), // Feb 9
    lockTime: new Date('2026-02-09T23:00:00Z'),
  },
  {
    number: 3,
    label: 'Week 3',
    date: new Date('2026-02-16T23:00:00Z'), // Feb 16
    lockTime: new Date('2026-02-16T23:00:00Z'),
  },
  {
    number: 4,
    label: 'Week 4',
    date: new Date('2026-02-23T23:00:00Z'), // Feb 23
    lockTime: new Date('2026-02-23T23:00:00Z'),
  },
  {
    number: 5,
    label: 'Playoff 1',
    date: new Date('2026-03-02T23:00:00Z'), // Mar 2
    lockTime: new Date('2026-03-02T23:00:00Z'),
  },
]

export function getCurrentGame() {
  const now = new Date()
  // Find the current or next upcoming game
  for (const game of GAMES) {
    // Game is still relevant until 8am the next morning (gives time to enter results)
    const nextMorning = new Date(game.date)
    nextMorning.setDate(nextMorning.getDate() + 1) // next day
    nextMorning.setUTCHours(14, 0, 0, 0) // 8am CST = 14:00 UTC

    if (now < nextMorning) {
      return game
    }
  }
  // All games completed, return last game
  return GAMES[GAMES.length - 1]
}

export function getGamePhase(game: typeof GAMES[number]) {
  const now = new Date()

  if (now < game.lockTime) {
    return 'open' // Can submit lines and picks
  } else {
    return 'locked' // Game in progress or completed
  }
}
