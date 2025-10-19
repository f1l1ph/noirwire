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
-- SECURE MESSAGING TABLES
-- ============================================================================
-- Tables for end-to-end encrypted messaging between wallets

-- Users table: stores public encryption keys for each wallet
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  public_enc_key TEXT NOT NULL, -- Base64 encoded public key for encryption
  alias TEXT, -- Optional display name
  avatar_url TEXT, -- Optional avatar URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

-- Conversations table: tracks conversations between two participants
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_a TEXT NOT NULL, -- Wallet address
  participant_b TEXT NOT NULL, -- Wallet address
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_snippet TEXT, -- Encrypted snippet for preview
  unread_count_for_a INTEGER DEFAULT 0,
  unread_count_for_b INTEGER DEFAULT 0,
  -- Ensure unique conversation pairs (order doesn't matter)
  CONSTRAINT unique_conversation UNIQUE (participant_a, participant_b),
  CONSTRAINT no_self_conversation CHECK (participant_a != participant_b)
);

-- Create indexes for faster conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON conversations(participant_b);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Messages table: stores encrypted messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  encrypted_payload TEXT NOT NULL, -- Base64 encoded encrypted message
  nonce TEXT NOT NULL, -- Encryption nonce
  version TEXT DEFAULT 'v1', -- Encryption version for future upgrades
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT messages_from_to_diff CHECK (from_wallet != to_wallet)
);

-- Create indexes for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to_wallet ON messages(to_wallet, read_at);

-- ============================================================================
-- RLS Policies for Secure Messaging
-- ============================================================================

-- Enable RLS on messaging tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users policies (for hackathon - permissive)
DROP POLICY IF EXISTS "Users public read" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;

CREATE POLICY "Users public read" ON users FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON users 
  FOR ALL USING (true) WITH CHECK (true);

-- Conversations policies (only participants can access)
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;

CREATE POLICY "Participants can view conversations" ON conversations 
  FOR SELECT USING (true);
  
CREATE POLICY "Users can create conversations" ON conversations 
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Participants can update conversations" ON conversations 
  FOR UPDATE USING (true) WITH CHECK (true);

-- Messages policies (only participants can access)
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

CREATE POLICY "Participants can view messages" ON messages 
  FOR SELECT USING (true);
  
CREATE POLICY "Users can send messages" ON messages 
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Users can update own messages" ON messages 
  FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- Messaging Helper Functions
-- ============================================================================

-- Function to update conversation timestamp on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.sent_at,
    last_message_snippet = LEFT(NEW.encrypted_payload, 100),
    updated_at = NOW(),
    unread_count_for_a = CASE 
      WHEN NEW.to_wallet = participant_a THEN unread_count_for_a + 1 
      ELSE unread_count_for_a 
    END,
    unread_count_for_b = CASE 
      WHEN NEW.to_wallet = participant_b THEN unread_count_for_b + 1 
      ELSE unread_count_for_b 
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Function to get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  wallet_a TEXT,
  wallet_b TEXT
)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Try to find existing conversation (either direction)
  SELECT id INTO conv_id
  FROM conversations
  WHERE (participant_a = wallet_a AND participant_b = wallet_b)
     OR (participant_a = wallet_b AND participant_b = wallet_a)
  LIMIT 1;
  
  -- If not found, create new conversation
  IF conv_id IS NULL THEN
    INSERT INTO conversations (participant_a, participant_b)
    VALUES (wallet_a, wallet_b)
    RETURNING id INTO conv_id;
  END IF;
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
  conv_id UUID,
  reader_wallet TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = conv_id
    AND to_wallet = reader_wallet
    AND read_at IS NULL;
    
  -- Reset unread count for this participant
  UPDATE conversations
  SET 
    unread_count_for_a = CASE 
      WHEN participant_a = reader_wallet THEN 0 
      ELSE unread_count_for_a 
    END,
    unread_count_for_b = CASE 
      WHEN participant_b = reader_wallet THEN 0 
      ELSE unread_count_for_b 
    END
  WHERE id = conv_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Cleanup Functions for Free Tier Management
-- ============================================================================

-- Function to archive old messages (keeps DB size manageable)
CREATE OR REPLACE FUNCTION archive_old_messages(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM messages
    WHERE sent_at < NOW() - INTERVAL '1 day' * days_old
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get database size estimate
CREATE OR REPLACE FUNCTION get_messaging_storage_size()
RETURNS TABLE(
  table_name TEXT,
  size_bytes BIGINT,
  size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'users'::TEXT,
    pg_total_relation_size('users'::regclass),
    ROUND(pg_total_relation_size('users'::regclass) / (1024.0 * 1024.0), 2)
  UNION ALL
  SELECT 
    'conversations'::TEXT,
    pg_total_relation_size('conversations'::regclass),
    ROUND(pg_total_relation_size('conversations'::regclass) / (1024.0 * 1024.0), 2)
  UNION ALL
  SELECT 
    'messages'::TEXT,
    pg_total_relation_size('messages'::regclass),
    ROUND(pg_total_relation_size('messages'::regclass) / (1024.0 * 1024.0), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Messaging Usage Examples
-- ============================================================================

-- Create a user with encryption key
/*
INSERT INTO users (wallet_address, public_enc_key, alias)
VALUES ('WalletAddress123', 'base64PublicKey', 'Alice')
ON CONFLICT (wallet_address) DO UPDATE SET
  public_enc_key = EXCLUDED.public_enc_key,
  last_seen_at = NOW();
*/

-- Get or create a conversation
/*
SELECT get_or_create_conversation('WalletA', 'WalletB');
*/

-- Send a message
/*
INSERT INTO messages (conversation_id, from_wallet, to_wallet, encrypted_payload, nonce)
VALUES ('conversation-uuid', 'WalletA', 'WalletB', 'encryptedData', 'nonce123');
*/

-- Get conversations for a wallet
/*
SELECT * FROM conversations
WHERE participant_a = 'WalletAddress' OR participant_b = 'WalletAddress'
ORDER BY last_message_at DESC NULLS LAST;
*/

-- Get messages in a conversation (paginated)
/*
SELECT * FROM messages
WHERE conversation_id = 'conversation-uuid'
ORDER BY sent_at DESC
LIMIT 50;
*/

-- Mark messages as read
/*
SELECT mark_messages_read('conversation-uuid', 'WalletAddress');
*/

-- Check storage usage
/*
SELECT * FROM get_messaging_storage_size();
*/

-- Archive messages older than 90 days
/*
SELECT archive_old_messages(90);
*/

-- ============================================================================
-- End of Schema
-- ============================================================================
