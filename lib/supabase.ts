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

// For convenience, export a getter that's called on demand
export const supabase = {
  from: (table: string) => getSupabase().from(table),
}

// Types for database tables
export interface Game {
  id: string
  game_number: number
  game_date: string
  lines_lock_time: string
  picks_lock_time: string
  status: 'upcoming' | 'lines_open' | 'picks_open' | 'in_progress' | 'completed'
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
  picked: boolean // true = betting they'll hit (over), false = not picking this line
  locked: boolean
  created_at: string
}

export interface PropPick {
  id: string
  game_id: string
  picker: string
  prop_type: 'most_pts' | 'most_3pm' | 'coolest_moment'
  player_picked: string
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

export interface Score {
  id: string
  game_id: string
  player: string
  correct_picks: number
  exact_lines: number
  total_points: number
  created_at: string
}
