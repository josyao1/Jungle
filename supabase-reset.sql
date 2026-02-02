-- DROP ALL TABLES (in correct order due to foreign keys)
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS prop_results CASCADE;
DROP TABLE IF EXISTS prop_picks CASCADE;
DROP TABLE IF EXISTS picks CASCADE;
DROP TABLE IF EXISTS lines CASCADE;
DROP TABLE IF EXISTS line_predictions CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- RECREATE TABLES

-- Games table
CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_number int NOT NULL UNIQUE,
  game_date timestamptz NOT NULL,
  lines_lock_time timestamptz NOT NULL,
  picks_lock_time timestamptz NOT NULL,
  status text DEFAULT 'upcoming',
  created_at timestamptz DEFAULT now()
);

-- Line predictions (submitted before lock)
CREATE TABLE line_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  submitter text NOT NULL,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, submitter, player, stat)
);

-- Averaged lines (calculated live)
CREATE TABLE lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

-- Over picks
CREATE TABLE picks (
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

-- Prop bet picks
CREATE TABLE prop_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  picker text NOT NULL,
  prop_type text NOT NULL,
  player_picked text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, picker, prop_type)
);

-- Prop bet results
CREATE TABLE prop_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  prop_type text NOT NULL,
  winner text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, prop_type)
);

-- Actual game results
CREATE TABLE results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  stat text NOT NULL,
  value int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player, stat)
);

-- Scores
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player text NOT NULL,
  correct_picks int DEFAULT 0,
  missed_picks int DEFAULT 0,
  exact_lines int DEFAULT 0,
  prop_wins int DEFAULT 0,
  prop_misses int DEFAULT 0,
  total_points decimal DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player)
);

-- Insert the 4 games
INSERT INTO games (game_number, game_date, lines_lock_time, picks_lock_time, status) VALUES
  (1, '2026-02-02T23:00:00Z', '2026-02-02T23:00:00Z', '2026-02-02T23:00:00Z', 'upcoming'),
  (2, '2026-02-09T23:00:00Z', '2026-02-09T23:00:00Z', '2026-02-09T23:00:00Z', 'upcoming'),
  (3, '2026-02-16T23:00:00Z', '2026-02-16T23:00:00Z', '2026-02-16T23:00:00Z', 'upcoming'),
  (4, '2026-02-23T23:00:00Z', '2026-02-23T23:00:00Z', '2026-02-23T23:00:00Z', 'upcoming');

-- Enable RLS and allow all (honor system)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON line_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prop_picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prop_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON scores FOR ALL USING (true) WITH CHECK (true);
