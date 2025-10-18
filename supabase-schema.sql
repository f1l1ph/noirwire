-- ============================================================================
-- NoirWire Supabase Schema
-- ============================================================================
-- This file contains the database schema for NoirWire's note storage
-- Run this in your Supabase SQL Editor to create the required tables
-- ============================================================================

-- Drop existing table if you need to reset (CAUTION: deletes all data)
-- DROP TABLE IF EXISTS user_notes;

-- Create user_notes table for encrypted note storage
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster wallet address lookups
CREATE INDEX IF NOT EXISTS idx_user_notes_wallet 
ON user_notes(wallet_address);

-- Add comment to table
COMMENT ON TABLE user_notes IS 'Stores encrypted privacy notes for each wallet';
COMMENT ON COLUMN user_notes.wallet_address IS 'Solana wallet public key (base58)';
COMMENT ON COLUMN user_notes.encrypted_data IS 'Base64-encoded encrypted notes JSON';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Note: For hackathon demo, we use permissive policies
-- For production, you should restrict access to authenticated users only

-- Enable Row Level Security
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations for hackathon" ON user_notes;

-- Allow all operations (FOR HACKATHON ONLY!)
-- In production, replace this with proper authentication
CREATE POLICY "Allow all operations for hackathon" 
ON user_notes FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================================================
-- Production RLS Policies (commented out for hackathon)
-- ============================================================================
-- Uncomment these for production deployment

/*
-- Drop the permissive policy first
DROP POLICY IF EXISTS "Allow all operations for hackathon" ON user_notes;

-- Allow users to read their own notes
CREATE POLICY "Users can read own notes"
ON user_notes FOR SELECT
USING (auth.uid()::text = wallet_address);

-- Allow users to insert their own notes
CREATE POLICY "Users can insert own notes"
ON user_notes FOR INSERT
WITH CHECK (auth.uid()::text = wallet_address);

-- Allow users to update their own notes
CREATE POLICY "Users can update own notes"
ON user_notes FOR UPDATE
USING (auth.uid()::text = wallet_address)
WITH CHECK (auth.uid()::text = wallet_address);

-- Allow users to delete their own notes
CREATE POLICY "Users can delete own notes"
ON user_notes FOR DELETE
USING (auth.uid()::text = wallet_address);
*/

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Test Data (Optional - for development only)
-- ============================================================================
-- Uncomment to insert test data

/*
INSERT INTO user_notes (wallet_address, encrypted_data) VALUES
  ('TestWallet123456789', 'dGVzdCBlbmNyeXB0ZWQgZGF0YQ==')
ON CONFLICT (wallet_address) DO NOTHING;
*/

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify the schema was created correctly

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_notes'
) AS table_exists;

-- Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_notes'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'user_notes';

-- Check RLS policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_notes';

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Insert or update notes for a wallet
/*
INSERT INTO user_notes (wallet_address, encrypted_data) 
VALUES ('YourWalletAddress', 'base64EncodedData')
ON CONFLICT (wallet_address) 
DO UPDATE SET 
  encrypted_data = EXCLUDED.encrypted_data,
  updated_at = NOW();
*/

-- Retrieve notes for a wallet
/*
SELECT encrypted_data, updated_at 
FROM user_notes 
WHERE wallet_address = 'YourWalletAddress';
*/

-- Delete notes for a wallet
/*
DELETE FROM user_notes 
WHERE wallet_address = 'YourWalletAddress';
*/

-- Count total stored wallets
/*
SELECT COUNT(*) as total_wallets FROM user_notes;
*/

-- ============================================================================
-- Cleanup (CAUTION: Deletes all data!)
-- ============================================================================
-- Uncomment to completely remove the schema

/*
DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS user_notes CASCADE;
*/

-- ============================================================================
-- End of Schema
-- ============================================================================
