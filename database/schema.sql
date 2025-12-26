-- =============================================
-- Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for invite_code lookups
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code);

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================
-- USER_STATUS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tasks TEXT[] DEFAULT '{}',
  busy_blocks JSONB DEFAULT '[]',
  free_after TIME,
  free_until TIME,
  blockers TEXT[] DEFAULT '{}',
  status_color VARCHAR(20) DEFAULT 'green' CHECK (status_color IN ('green', 'yellow', 'red')),
  raw_transcript TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 1.00,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_last_updated ON user_status(last_updated DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's team_id (for RLS policies)
CREATE OR REPLACE FUNCTION get_user_team_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Trigger to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_status table
DROP TRIGGER IF EXISTS trigger_update_user_status_timestamp ON user_status;
CREATE TRIGGER trigger_update_user_status_timestamp
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated();

-- =============================================
-- VIEWS
-- =============================================

-- View to get team members with their status
CREATE OR REPLACE VIEW team_members_status AS
SELECT 
  u.id AS user_id,
  u.name,
  u.email,
  u.avatar_url,
  u.team_id,
  t.name AS team_name,
  us.tasks,
  us.busy_blocks,
  us.free_after,
  us.free_until,
  us.blockers,
  us.status_color,
  us.last_updated
FROM users u
LEFT JOIN teams t ON u.team_id = t.id
LEFT JOIN user_status us ON u.id = us.user_id;
