-- Jungle Softball Sportsbook Schema
-- All tables prefixed with jungle_ to avoid conflicts with other projects
-- Run this in your Supabase SQL Editor to set up a fresh database

CREATE TABLE IF NOT EXISTS jungle_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_number int NOT NULL,
  game_date timestamptz NOT NULL,
  lines_lock_time timestamptz NOT NULL,
  picks_lock_time timestamptz NOT NULL,
  status text DEFAULT 'upcoming',
  forfeited boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jungle_line_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  submitter text NOT NULL,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, submitter, player, stat)
);

CREATE TABLE IF NOT EXISTS jungle_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

CREATE TABLE IF NOT EXISTS jungle_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  picker text NOT NULL,
  player text NOT NULL,
  stat text NOT NULL,
  picked boolean DEFAULT true,
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, picker, player, stat)
);

CREATE TABLE IF NOT EXISTS jungle_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

CREATE TABLE IF NOT EXISTS jungle_prop_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  picker text NOT NULL,
  prop_type text NOT NULL,
  player_picked text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, picker, prop_type)
);

CREATE TABLE IF NOT EXISTS jungle_prop_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  prop_type text NOT NULL,
  winner text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, prop_type)
);

CREATE TABLE IF NOT EXISTS jungle_player_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  player text NOT NULL,
  active boolean DEFAULT true,
  reason text DEFAULT 'OUT',
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player)
);

CREATE TABLE IF NOT EXISTS jungle_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  player text NOT NULL,
  correct_picks int DEFAULT 0,
  missed_picks int DEFAULT 0,
  total_points decimal DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player)
);

-- Team MVP + game recap blurb set by admin per week
CREATE TABLE IF NOT EXISTS jungle_weekly_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES jungle_games(id) ON DELETE CASCADE,
  mvp_player text,
  mvp_blurb text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id)
);

-- Insert 5 games: Sundays at 3pm CDT (20:00 UTC) starting April 12, 2026
INSERT INTO jungle_games (game_number, game_date, lines_lock_time, picks_lock_time, status) VALUES
  (1, '2026-04-12T20:00:00Z', '2026-04-12T20:00:00Z', '2026-04-12T20:00:00Z', 'upcoming'),
  (2, '2026-04-19T20:00:00Z', '2026-04-19T20:00:00Z', '2026-04-19T20:00:00Z', 'upcoming'),
  (3, '2026-04-26T20:00:00Z', '2026-04-26T20:00:00Z', '2026-04-26T20:00:00Z', 'upcoming'),
  (4, '2026-05-03T20:00:00Z', '2026-05-03T20:00:00Z', '2026-05-03T20:00:00Z', 'upcoming'),
  (5, '2026-05-10T20:00:00Z', '2026-05-10T20:00:00Z', '2026-05-10T20:00:00Z', 'upcoming')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE jungle_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_line_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_prop_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_prop_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_player_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE jungle_weekly_highlights ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for anon users - honor system)
CREATE POLICY "Allow all" ON jungle_games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_line_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_prop_picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_prop_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_player_availability FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON jungle_weekly_highlights FOR ALL USING (true) WITH CHECK (true);
