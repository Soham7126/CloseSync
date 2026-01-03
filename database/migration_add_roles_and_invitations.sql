-- =============================================
-- Migration: Add Roles and Email Invitations
-- Run this in Supabase SQL Editor after schema.sql
-- =============================================

-- =============================================
-- ADD ROLE COLUMN TO USERS TABLE
-- =============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member'
CHECK (role IN ('super_admin', 'admin', 'member'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =============================================
-- TEAM_INVITATIONS TABLE
-- For tracking email invitations
-- =============================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for team_invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- =============================================
-- FUNCTION: Generate secure invitation token
-- =============================================
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS VARCHAR(64) AS $$
DECLARE
  chars VARCHAR(62) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(64) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..64 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS POLICIES FOR TEAM_INVITATIONS
-- =============================================
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Super admins can view all invitations for their team
CREATE POLICY "Team admins can view team invitations"
  ON team_invitations FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Super admins can create invitations
CREATE POLICY "Super admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND team_id IN (
      SELECT team_id FROM users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can update invitations (cancel them)
CREATE POLICY "Super admins can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Anyone can view invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token"
  ON team_invitations FOR SELECT
  USING (true);
