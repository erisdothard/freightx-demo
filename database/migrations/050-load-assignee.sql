-- Migration 050: Add assignee_id to loads
ALTER TABLE loads ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
