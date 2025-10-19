/**
 * Supabase Client for NoirWire Messaging
 *
 * Handles all Supabase interactions for messaging:
 * - User management (public keys)
 * - Conversations
 * - Messages
 * - Realtime subscriptions
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';

// Database types
export interface User {
  id: string;
  wallet_address: string;
  public_enc_key: string;
  alias?: string;
  avatar_url?: string;
  created_at: string;
  last_seen_at: string;
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  last_message_snippet?: string;
  unread_count_for_a: number;
  unread_count_for_b: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  from_wallet: string;
  to_wallet: string;
  sent_at: string;
  encrypted_payload: string;
  nonce: string;
  version: string;
  read_at?: string;
}

// Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 * Call this once at app startup with environment variables
 */
export function initializeSupabase(
  url: string,
  anonKey: string,
): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: false, // We handle auth via wallet
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // Rate limit for free tier
        },
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'noirwire-web',
        },
      },
    });
  }
  return supabaseClient;
}

/**
 * Get Supabase client instance
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase not initialized. Call initializeSupabase() first.',
    );
  }
  return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Create or update user with public encryption key
 */
export async function upsertUser(
  walletAddress: string,
  publicEncKey: string,
  alias?: string,
): Promise<User> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        wallet_address: walletAddress,
        public_enc_key: publicEncKey,
        alias: alias || null,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'wallet_address',
      },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert user: ${error.message}`);
  return data as User;
}

/**
 * Get user by wallet address
 */
export async function getUserByWallet(
  walletAddress: string,
): Promise<User | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) throw new Error(`Failed to get user: ${error.message}`);
  return data as User | null;
}

/**
 * Search users by wallet address or alias
 */
export async function searchUsers(query: string, limit = 10): Promise<User[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`wallet_address.ilike.%${query}%,alias.ilike.%${query}%`)
    .limit(limit);

  if (error) throw new Error(`Failed to search users: ${error.message}`);
  return (data as User[]) || [];
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

/**
 * Get or create conversation between two wallets
 */
export async function getOrCreateConversation(
  walletA: string,
  walletB: string,
): Promise<Conversation> {
  const supabase = getSupabase();

  // Try to find existing conversation (either direction)
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .or(
      `and(participant_a.eq.${walletA},participant_b.eq.${walletB}),and(participant_a.eq.${walletB},participant_b.eq.${walletA})`,
    )
    .maybeSingle();

  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Failed to find conversation: ${findError.message}`);
  }

  if (existing) {
    return existing as Conversation;
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabase
    .from('conversations')
    .insert({
      participant_a: walletA,
      participant_b: walletB,
    })
    .select()
    .single();

  if (createError)
    throw new Error(`Failed to create conversation: ${createError.message}`);
  return newConv as Conversation;
}

/**
 * Get all conversations for a wallet
 */
export async function getConversations(
  walletAddress: string,
): Promise<Conversation[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${walletAddress},participant_b.eq.${walletAddress}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to get conversations: ${error.message}`);
  return (data as Conversation[]) || [];
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
): Promise<Conversation | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get conversation: ${error.message}`);
  return data as Conversation | null;
}

/**
 * Get unread count for a wallet in a conversation
 */
export function getUnreadCount(
  conversation: Conversation,
  walletAddress: string,
): number {
  if (conversation.participant_a === walletAddress) {
    return conversation.unread_count_for_a;
  } else if (conversation.participant_b === walletAddress) {
    return conversation.unread_count_for_b;
  }
  return 0;
}

/**
 * Get the other participant in a conversation
 */
export function getOtherParticipant(
  conversation: Conversation,
  walletAddress: string,
): string {
  return conversation.participant_a === walletAddress
    ? conversation.participant_b
    : conversation.participant_a;
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Send a message
 * Uses optimized insert with minimal response
 */
export async function sendMessage(
  conversationId: string,
  fromWallet: string,
  toWallet: string,
  encryptedPayload: string,
  nonce: string,
  version: string = 'v1',
): Promise<Message> {
  const supabase = getSupabase();

  const messageData = {
    conversation_id: conversationId,
    from_wallet: fromWallet,
    to_wallet: toWallet,
    encrypted_payload: encryptedPayload,
    nonce,
    version,
    sent_at: new Date().toISOString(), // Set client-side for optimistic update
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select(
      'id, conversation_id, from_wallet, to_wallet, sent_at, encrypted_payload, nonce, version, read_at',
    )
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);
  return data as Message;
}

/**
 * Send a message with optimistic response (for instant UI)
 * Returns a temporary message object immediately
 */
export function createOptimisticMessage(
  conversationId: string,
  fromWallet: string,
  toWallet: string,
  encryptedPayload: string,
  nonce: string,
  version: string = 'v1',
): Message {
  return {
    id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
    conversation_id: conversationId,
    from_wallet: fromWallet,
    to_wallet: toWallet,
    sent_at: new Date().toISOString(),
    encrypted_payload: encryptedPayload,
    nonce,
    version,
  };
}

/**
 * Get messages for a conversation (paginated)
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Message[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get messages: ${error.message}`);

  // Reverse to show oldest first
  return ((data as Message[]) || []).reverse();
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  conversationId: string,
  walletAddress: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.rpc('mark_messages_read', {
    conv_id: conversationId,
    reader_wallet: walletAddress,
  });

  if (error) {
    console.warn('Failed to mark messages as read:', error);
    // Don't throw - this is non-critical
  }
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to new messages for a wallet
 */
export function subscribeToMessages(
  walletAddress: string,
  callback: (message: Message) => void,
): RealtimeChannel {
  const supabase = getSupabase();

  const channel = supabase
    .channel(`messages:${walletAddress}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_wallet=eq.${walletAddress}`,
      },
      (payload) => {
        callback(payload.new as Message);
      },
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to conversation updates
 */
export function subscribeToConversations(
  walletAddress: string,
  callback: (conversation: Conversation) => void,
): RealtimeChannel {
  const supabase = getSupabase();

  // Subscribe to updates where user is participant
  const channel = supabase
    .channel(`conversations:${walletAddress}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_a=eq.${walletAddress}`,
      },
      (payload) => {
        callback(payload.new as Conversation);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_b=eq.${walletAddress}`,
      },
      (payload) => {
        callback(payload.new as Conversation);
      },
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
  await channel.unsubscribe();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format timestamp for display
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Format as date
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate message for preview
 */
export function truncateMessage(
  message: string,
  maxLength: number = 50,
): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + '...';
}
