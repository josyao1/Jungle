/**
 * game.ts — Shared helpers for resolving the current game and its DB record.
 *
 * Used by pick/page.tsx, set-lines/page.tsx, and any other page that needs
 * to determine which game is active and get its Supabase row ID.
 */

import { GAMES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

/**
 * Returns the current active game — the first game whose end time
 * (start + 3 hours) hasn't passed yet. Falls back to the last game.
 */
export function findCurrentGame() {
  const now = new Date()
  return (
    GAMES.find(g => now < new Date(g.date.getTime() + 3 * 60 * 60 * 1000)) ||
    GAMES[GAMES.length - 1]
  )
}

/**
 * Returns the Supabase row ID for a given game number, creating the row
 * if it doesn't exist yet. Returns null if the game number isn't in GAMES
 * or if the insert fails.
 */
export async function getOrCreateGameRecord(gameNumber: number): Promise<{ id: string } | null> {
  const game = GAMES.find(g => g.number === gameNumber)
  if (!game) return null

  let { data } = await supabase
    .from('jungle_games')
    .select('id')
    .eq('game_number', gameNumber)
    .single()

  if (!data) {
    const { data: newGame, error } = await supabase
      .from('jungle_games')
      .insert({
        game_number: game.number,
        game_date: game.date.toISOString(),
        lines_lock_time: game.lockTime.toISOString(),
        picks_lock_time: game.lockTime.toISOString(),
        status: 'upcoming',
        forfeited: false,
      })
      .select('id')
      .single()

    if (error || !newGame) return null
    data = newGame
  }

  return data
}
