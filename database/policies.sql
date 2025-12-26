-- =============================================
-- Row Level Security (RLS) Policies
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TEAMS POLICIES
-- =============================================

-- Users can view their own team
CREATE POLICY "Users can view their own team"
  ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can view teams by invite code (for joining)
CREATE POLICY "Anyone can view team by invite code"
  ON teams FOR SELECT
  USING (true);

-- Team creators can update their team
CREATE POLICY "Team members can update their team"
  ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Authenticated users can create teams
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- USERS POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can view teammates (same team)
CREATE POLICY "Users can view teammates"
  ON users FOR SELECT
  USING (
    team_id IS NOT NULL AND
    team_id = get_user_team_id(auth.uid())
  );

-- Users can insert their own profile on signup
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON users FOR DELETE
  USING (id = auth.uid());

-- =============================================
-- USER_STATUS POLICIES
-- =============================================

-- Users can view their own status
CREATE POLICY "Users can view their own status"
  ON user_status FOR SELECT
  USING (user_id = auth.uid());

-- Users can view teammates' status
CREATE POLICY "Users can view teammates status"
  ON user_status FOR SELECT
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.team_id IS NOT NULL
      AND u.team_id = get_user_team_id(auth.uid())
    )
  );

-- Users can insert their own status
CREATE POLICY "Users can insert their own status"
  ON user_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own status
CREATE POLICY "Users can update their own status"
  ON user_status FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own status
CREATE POLICY "Users can delete their own status"
  ON user_status FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to tables
GRANT SELECT ON teams TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_status TO authenticated;
GRANT INSERT, UPDATE ON teams TO authenticated;

-- Grant access to views
GRANT SELECT ON team_members_status TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
