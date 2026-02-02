-- Jungle Sportsbook Database Schema
-- Run this in your Supabase SQL Editor

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_number int NOT NULL,
  game_date timestamptz NOT NULL,
  lines_lock_time timestamptz NOT NULL,
  picks_lock_time timestamptz NOT NULL,
  status text DEFAULT 'upcoming',
  created_at timestamptz DEFAULT now()
);

-- Line predictions (submitted before lines lock)
CREATE TABLE IF NOT EXISTS line_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  submitter text NOT NULL,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, submitter, player, stat)
);

-- Averaged lines (calculated when lines lock)
CREATE TABLE IF NOT EXISTS lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

-- Over picks (only overs, no unders - supportive betting!)
CREATE TABLE IF NOT EXISTS picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  picker text NOT NULL,
  player text NOT NULL,
  stat text NOT NULL,
  picked boolean DEFAULT true,
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, picker, player, stat)
);

-- Prop bet picks (most pts, most 3pm, coolest moment)
CREATE TABLE IF NOT EXISTS prop_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  picker text NOT NULL,
  prop_type text NOT NULL,
  player_picked text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, picker, prop_type)
);

-- Prop bet results (who won each prop)
CREATE TABLE IF NOT EXISTS prop_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  prop_type text NOT NULL,
  winner text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, prop_type)
);

-- Actual game results
CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

-- Leaderboard scores (calculated after results entered)
CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  correct_picks int DEFAULT 0,
  exact_lines int DEFAULT 0,
  prop_wins int DEFAULT 0,
  total_points decimal DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player)
);

-- Insert the 4 games (Mondays at 5pm CST = 11pm UTC)
-- Game 1: Feb 2, 2026
-- Game 2: Feb 9, 2026
-- Game 3: Feb 16, 2026
-- Game 4: Feb 23, 2026
INSERT INTO games (game_number, game_date, lines_lock_time, picks_lock_time, status) VALUES
  (1, '2026-02-02T23:00:00Z', '2026-02-02T22:30:00Z', '2026-02-02T23:00:00Z', 'upcoming'),
  (2, '2026-02-09T23:00:00Z', '2026-02-09T22:30:00Z', '2026-02-09T23:00:00Z', 'upcoming'),
  (3, '2026-02-16T23:00:00Z', '2026-02-16T22:30:00Z', '2026-02-16T23:00:00Z', 'upcoming'),
  (4, '2026-02-23T23:00:00Z', '2026-02-23T22:30:00Z', '2026-02-23T23:00:00Z', 'upcoming')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (allow all for simplicity - honor system)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Policies (allow all operations for anon users)
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON line_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prop_picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prop_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON scores FOR ALL USING (true) WITH CHECK (true);
