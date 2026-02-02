export const PLAYERS = ['andy', 'andrew', 'josh', 'ronit', 'aarnav', 'pranay'] as const
export type Player = typeof PLAYERS[number]

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
export const PROP_BETS = ['most_pts', 'most_3pm', 'coolest_moment'] as const
export type PropBet = typeof PROP_BETS[number]

export const PROP_BET_LABELS: Record<PropBet, string> = {
  most_pts: 'Most Points',
  most_3pm: 'Most 3-Pointers',
  coolest_moment: 'Coolest Moment',
}

// Game dates - all at 5pm CST (UTC-6 = 11pm UTC)
// Lines lock at 4:30pm CST, picks lock at 5pm CST
export const GAMES = [
  {
    number: 1,
    date: new Date('2026-02-02T23:00:00Z'), // Feb 2 at 5pm CST
    linesLock: new Date('2026-02-02T22:30:00Z'), // 4:30pm CST
    picksLock: new Date('2026-02-02T23:00:00Z'), // 5pm CST
  },
  {
    number: 2,
    date: new Date('2026-02-09T23:00:00Z'), // Feb 9
    linesLock: new Date('2026-02-09T22:30:00Z'),
    picksLock: new Date('2026-02-09T23:00:00Z'),
  },
  {
    number: 3,
    date: new Date('2026-02-16T23:00:00Z'), // Feb 16
    linesLock: new Date('2026-02-16T22:30:00Z'),
    picksLock: new Date('2026-02-16T23:00:00Z'),
  },
  {
    number: 4,
    date: new Date('2026-02-23T23:00:00Z'), // Feb 23
    linesLock: new Date('2026-02-23T22:30:00Z'),
    picksLock: new Date('2026-02-23T23:00:00Z'),
  },
]

export function getCurrentGame() {
  const now = new Date()
  // Find the current or next upcoming game
  for (const game of GAMES) {
    // Game is still relevant if it hasn't been completed (give 3 hours after start for results)
    const gameEndBuffer = new Date(game.date.getTime() + 3 * 60 * 60 * 1000)
    if (now < gameEndBuffer) {
      return game
    }
  }
  // All games completed, return last game
  return GAMES[GAMES.length - 1]
}

export function getGamePhase(game: typeof GAMES[number]) {
  const now = new Date()

  if (now < game.linesLock) {
    return 'lines_open' // Can submit line predictions
  } else if (now < game.picksLock) {
    return 'picks_open' // Can make over/under picks
  } else {
    return 'game_started' // Game in progress or completed
  }
}
