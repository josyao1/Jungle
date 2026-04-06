/**
 * supabase.ts — Supabase client and TypeScript interfaces for all DB tables.
 *
 * Tables:
 *  - games: Season schedule with lock times and forfeit flag
 *  - line_predictions: Each player's stat predictions before lock
 *  - lines: Averaged/aggregated lines computed from predictions
 *  - picks: Over bets placed by each bettor
 *  - results: Actual game stats entered after the game
 *  - player_availability: Per-game active/inactive status (managed by Joshua via admin page)
 *  - scores: Computed scores per player per game
 *
 * getActivePlayersForGame: Fetches which players are active for a given game_id.
 *   Defaults to all players if no availability rows exist.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

export const supabase = {
  from: (table: string) => getSupabase().from(table),
}

export interface Game {
  id: string
  game_number: number
  game_date: string
  lines_lock_time: string
  picks_lock_time: string
  status: 'upcoming' | 'lines_open' | 'picks_open' | 'in_progress' | 'completed'
  forfeited: boolean
  created_at: string
}

export interface LinePrediction {
  id: string
  game_id: string
  submitter: string
  player: string
  stat: string
  value: number
  created_at: string
}

export interface Line {
  id: string
  game_id: string
  player: string
  stat: string
  value: number
  created_at: string
}

export interface Pick {
  id: string
  game_id: string
  picker: string
  player: string
  stat: string
  picked: boolean
  locked: boolean
  created_at: string
}

export interface Result {
  id: string
  game_id: string
  player: string
  stat: string
  value: number
  created_at: string
}

export interface PlayerAvailability {
  id: string
  game_id: string
  player: string
  active: boolean
  created_at: string
}

export interface Score {
  id: string
  game_id: string
  player: string
  correct_picks: number
  missed_picks: number
  total_points: number
  created_at: string
}

// Returns the set of players marked inactive for a given game_id.
// Empty set = everyone active (default when no availability rows exist).
export async function getInactivePlayersForGame(gameId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('jungle_player_availability')
    .select('player, active')
    .eq('game_id', gameId)

  if (!data || data.length === 0) return new Set()

  return new Set(data.filter(row => !row.active).map(row => row.player))
}
