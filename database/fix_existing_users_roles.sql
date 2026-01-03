-- =============================================
-- Fix Existing Users Roles
-- Run this AFTER migration_add_roles_and_invitations.sql
-- This script sets roles for existing users who don't have one
-- =============================================

-- First, set all users without a role to 'member' as default
UPDATE users
SET role = 'member'
WHERE role IS NULL;

-- Now, for each team, find the first user who joined (by created_at)
-- and make them super_admin (assuming team creator joined first)
-- This is a heuristic - in production you might need manual intervention

WITH first_team_members AS (
  SELECT DISTINCT ON (team_id)
    id,
    team_id,
    created_at
  FROM users
  WHERE team_id IS NOT NULL
  ORDER BY team_id, created_at ASC
)
UPDATE users u
SET role = 'super_admin'
FROM first_team_members ftm
WHERE u.id = ftm.id;

-- Alternative: If you know specific users who should be super_admin,
-- you can update them directly:
-- UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';

-- Verify the results
SELECT id, email, name, team_id, role, created_at
FROM users
ORDER BY team_id, created_at;
