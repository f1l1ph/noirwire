'use client';

import { useEffect, useState, useRef, FormEvent, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PlusIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import styles from './page.module.css';
import Navigation from '../components/Navigation';
import {
  initializeSupabase,
  getConversations,
  getMessages,
  sendMessage as sendMessageToSupabase,
  createOptimisticMessage,
  getOrCreateConversation,
  getUserByWallet,
  upsertUser,
  subscribeToMessages,
  subscribeToConversations,
  formatMessageTime,
  getOtherParticipant,
  getUnreadCount,
  markMessagesAsRead,
  type Conversation,
  type Message,
} from '../../lib/supabaseClient';
import {
  initializeEncryption,
  encryptMessage,
  decryptMessage,
  isEncryptionInitialized,
  getPublicKey,
} from '../../lib/encryptionManager';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function MessagesPage() {
  const { publicKey, connected } = useWallet();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatAddress, setNewChatAddress] = useState('');
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [supabaseInitialized, setSupabaseInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Cache for user public keys to avoid repeated queries
  const userCacheRef = useRef<Map<string, { publicKey: string; timestamp: number }>>(new Map());

  // Initialize Supabase
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      initializeSupabase(supabaseUrl, supabaseKey);
      setSupabaseInitialized(true);
    } else {
      setError('Supabase configuration missing. Please check your environment variables.');
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize encryption when wallet connects
  useEffect(() => {
    if (!publicKey || !connected || !supabaseInitialized) return;

    const setupEncryption = async () => {
      try {
        const walletAddress = publicKey.toBase58();
        
        // Initialize encryption keys locally if needed
        const ready = await isEncryptionInitialized(walletAddress);
        let publicEncKey: string | null;
        
        if (!ready) {
          // Generate keypair and store locally
          publicEncKey = await initializeEncryption(walletAddress);
          console.log('✅ Generated new encryption keypair');
        } else {
          // Get existing public key
          publicEncKey = await getPublicKey(walletAddress);
          if (!publicEncKey) {
            throw new Error('Failed to retrieve public key from local storage');
          }
        }
        
        // ALWAYS ensure user exists in Supabase (handles both new and existing users)
        try {
          const existingUser = await getUserByWallet(walletAddress);
          if (!existingUser) {
            console.log('🔑 Registering user in Supabase...');
            await upsertUser(walletAddress, publicEncKey);
            console.log('✅ User registered in Supabase');
          } else {
            console.log('✅ User already exists in Supabase');
          }
        } catch (dbError) {
          console.error('❌ Failed to register user in Supabase:', dbError);
          throw new Error('Failed to register encryption keys. Please check your connection.');
        }
        
        setEncryptionReady(true);
      } catch (err) {
        console.error('Failed to initialize encryption:', err);
        setError('Failed to initialize encryption. Please refresh the page.');
      }
    };

    setupEncryption();
  }, [publicKey, connected, supabaseInitialized]);

  // Load conversations
  useEffect(() => {
    if (!publicKey || !connected || !encryptionReady || !supabaseInitialized) return;

    const loadConversations = async () => {
      try {
        setLoading(true);
        const walletAddress = publicKey.toBase58();
        const convos = await getConversations(walletAddress);
        setConversations(convos);
      } catch (err) {
        console.error('Failed to load conversations:', err);
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();

    // Subscribe to realtime conversation updates
    const channel = subscribeToConversations(
      publicKey.toBase58(),
      (updatedConvo) => {
        setConversations((prev) =>
          prev.map((c) => (c.id === updatedConvo.id ? updatedConvo : c))
        );
      }
    );

    return () => {
      channel.unsubscribe();
    };
  }, [publicKey, connected, encryptionReady, supabaseInitialized]);

  // Decrypt messages helper
  const decryptMessages = useCallback(async (msgs: Message[]) => {
    if (!publicKey) return;

    const walletAddress = publicKey.toBase58();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    for (const msg of msgs) {
      try {
        // Determine the "other" participant's wallet
        // If we're the sender, use recipient's public key
        // If we're the receiver, use sender's public key
        const otherWallet = msg.from_wallet === walletAddress 
          ? msg.to_wallet 
          : msg.from_wallet;
        
        let otherPublicKey: string;

        // Check cache first
        const cached = userCacheRef.current.get(otherWallet);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          otherPublicKey = cached.publicKey;
        } else {
          // Fetch from database
          const otherUser = await getUserByWallet(otherWallet);
          if (!otherUser) {
            console.warn('Other user not found:', otherWallet);
            continue;
          }
          otherPublicKey = otherUser.public_enc_key;
          // Update cache
          userCacheRef.current.set(otherWallet, {
            publicKey: otherPublicKey,
            timestamp: Date.now(),
          });
        }

        // Decrypt message using the other participant's public key
        const decrypted = await decryptMessage(
          {
            ciphertext: msg.encrypted_payload,
            nonce: msg.nonce,
            version: msg.version,
          },
          walletAddress,
          otherPublicKey
        );

        // Update state with functional update to avoid dependency on decryptedMessages
        setDecryptedMessages((prev) => {
          if (prev.has(msg.id)) return prev; // Already decrypted
          const newMap = new Map(prev);
          newMap.set(msg.id, decrypted);
          return newMap;
        });
      } catch (err) {
        console.error('Failed to decrypt message:', msg.id, err);
        setDecryptedMessages((prev) => {
          if (prev.has(msg.id)) return prev;
          const newMap = new Map(prev);
          newMap.set(msg.id, '[Decryption failed]');
          return newMap;
        });
      }
    }
  }, [publicKey]); // Only depend on publicKey, not decryptedMessages!

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !publicKey || !encryptionReady) return;

    // Clear previous messages and decrypted cache when switching conversations
    setMessages([]);
    setDecryptedMessages(new Map());
    setLoadingMessages(true);

    const loadMessages = async () => {
      try {
        const msgs = await getMessages(selectedConversation.id);
        setMessages(msgs);
        await decryptMessages(msgs);
        
        // Mark as read
        await markMessagesAsRead(selectedConversation.id, publicKey.toBase58());
      } catch (err) {
        console.error('Failed to load messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();

    // Subscribe to realtime updates for messages
    const channel = subscribeToMessages(publicKey.toBase58(), async (newMessage) => {
      if (newMessage.conversation_id === selectedConversation.id) {
        // Check if message already exists (prevent duplicates from optimistic updates)
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
        
        // Decrypt the new message
        await decryptMessages([newMessage]);
        
        // Auto-scroll to bottom
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [selectedConversation, publicKey, encryptionReady, decryptMessages]);

  // Send message handler with optimistic updates
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation || !publicKey || sending) return;

    const messageText = messageInput.trim();
    const walletAddress = publicKey.toBase58();
    const otherParticipant = getOtherParticipant(selectedConversation, walletAddress);

    // Clear input immediately for better UX
    setMessageInput('');
    setSending(true);

    try {
      // Ensure current user exists in database (safety check)
      const currentUser = await getUserByWallet(walletAddress);
      if (!currentUser) {
        // Re-register if somehow missing
        const publicEncKey = await getPublicKey(walletAddress);
        if (publicEncKey) {
          await upsertUser(walletAddress, publicEncKey);
        } else {
          throw new Error('Your encryption keys are not initialized. Please refresh the page.');
        }
      }

      // Get recipient's public key (with caching)
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      let recipientPublicKey: string;

      const cached = userCacheRef.current.get(otherParticipant);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        recipientPublicKey = cached.publicKey;
      } else {
        const recipientUser = await getUserByWallet(otherParticipant);
        if (!recipientUser) {
          throw new Error('Recipient not found');
        }
        recipientPublicKey = recipientUser.public_enc_key;
        userCacheRef.current.set(otherParticipant, {
          publicKey: recipientPublicKey,
          timestamp: Date.now(),
        });
      }

      // Encrypt message
      const encrypted = await encryptMessage(
        messageText,
        walletAddress,
        recipientPublicKey
      );

      // Create optimistic message (show immediately)
      const optimisticMessage = createOptimisticMessage(
        selectedConversation.id,
        walletAddress,
        otherParticipant,
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.version
      );

      // Add to UI immediately (optimistic update)
      setMessages((prev) => [...prev, optimisticMessage]);
      setDecryptedMessages((prev) => new Map(prev).set(optimisticMessage.id, messageText));
      
      // Scroll to bottom immediately
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

      // Send to server in background
      const savedMessage = await sendMessageToSupabase(
        selectedConversation.id,
        walletAddress,
        otherParticipant,
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.version
      );

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? savedMessage : msg))
      );
      setDecryptedMessages((prev) => {
        const newMap = new Map(prev);
        newMap.delete(optimisticMessage.id);
        newMap.set(savedMessage.id, messageText);
        return newMap;
      });

    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      // Restore input on error
      setMessageInput(messageText);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Start new conversation
  const handleNewConversation = async () => {
    if (!newChatAddress.trim() || !publicKey) return;

    try {
      const walletAddress = publicKey.toBase58();
      
      // Check if user exists
      const recipientUser = await getUserByWallet(newChatAddress);
      if (!recipientUser) {
        setError('Recipient wallet not found. They need to connect to NoirWire first.');
        return;
      }

      // Create or get conversation
      const conversation = await getOrCreateConversation(walletAddress, newChatAddress);
      
      // Add to list if new
      if (!conversations.find((c) => c.id === conversation.id)) {
        setConversations((prev) => [conversation, ...prev]);
      }

      // Select conversation
      setSelectedConversation(conversation);
      setShowNewChat(false);
      setNewChatAddress('');
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to start conversation');
    }
  };

  if (!connected) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <ChatBubbleLeftRightIcon className={styles.emptyStateIcon} />
          <p>Please connect your wallet to access messages</p>
        </div>
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>Supabase not configured. Please set environment variables.</p>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Universal Navigation */}
      <Navigation />
      
      {/* Page Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Secure Messages</h1>
          <p>End-to-end encrypted messaging</p>
        </div>
      </header>

      {/* Main container */}
      <div className={styles.container}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <button className={styles.newChatButton} onClick={() => setShowNewChat(true)}>
              <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
              New Conversation
            </button>
          </div>

          <div className={styles.conversationList}>
            {loading ? (
              <LoadingSkeleton variant="conversation" count={5} />
            ) : conversations.length === 0 ? (
              <div className={`${styles.emptyState} ${styles.emptyStateSmall}`}>
                <p className={styles.emptyStateText}>No conversations yet</p>
              </div>
            ) : (
              conversations.map((convo) => {
                const otherWallet = publicKey ? getOtherParticipant(convo, publicKey.toBase58()) : '';
                const unread = publicKey ? getUnreadCount(convo, publicKey.toBase58()) : 0;
                const isActive = selectedConversation?.id === convo.id;

                return (
                  <div
                    key={convo.id}
                    className={`${styles.conversationItem} ${isActive ? styles.conversationItemActive : ''}`}
                    onClick={() => setSelectedConversation(convo)}
                  >
                    <div className={styles.conversationHeader}>
                      <span className={styles.conversationWallet}>
                        {otherWallet.slice(0, 4)}...{otherWallet.slice(-4)}
                      </span>
                      {convo.last_message_at && (
                        <span className={styles.conversationTime}>
                          {formatMessageTime(convo.last_message_at)}
                        </span>
                      )}
                    </div>
                    {convo.last_message_snippet && (
                      <div className={styles.conversationPreview}>
                        {convo.last_message_snippet}
                      </div>
                    )}
                    {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main content */}
        <div className={styles.mainContent}>
          {!selectedConversation ? (
            <div className={styles.emptyState}>
              <ChatBubbleLeftRightIcon className={styles.emptyStateIcon} />
              <p>Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className={styles.threadHeader}>
                <span className={styles.threadRecipient}>
                  {publicKey && getOtherParticipant(selectedConversation, publicKey.toBase58())}
                </span>
              </div>

              {/* Messages */}
              <div className={styles.threadMessages}>
                {loadingMessages ? (
                  <LoadingSkeleton variant="message" count={5} />
                ) : (
                  messages.map((msg) => {
                    const isSent = msg.from_wallet === publicKey?.toBase58();
                    const decryptedText = decryptedMessages.get(msg.id) || 'Decrypting...';
                    const isPending = msg.id.startsWith('temp-'); // Check if optimistic message

                      return (
                      <div
                        key={msg.id}
                        className={`${styles.messageBubble} ${isSent ? styles.messageSent : styles.messageReceived} ${isPending ? styles.messagePending : ''}`}
                      >
                        <div className={styles.messageText}>{decryptedText}</div>
                        <div className={styles.messageTime}>
                          {formatMessageTime(msg.sent_at)}
                          {isPending && <span className={styles.sendingIndicator}> • Sending...</span>}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={styles.inputContainer}>
                <form className={styles.inputForm} onSubmit={handleSendMessage}>
                  <div className={styles.inputWrapper}>
                    <textarea
                      className={styles.input}
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      rows={1}
                    />
                  </div>
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={!messageInput.trim() || sending}
                  >
                    <PaperAirplaneIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewChat && (
        <div className={styles.modalOverlay} onClick={() => setShowNewChat(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>New Conversation</h2>
            <input
              type="text"
              placeholder="Enter wallet address..."
              value={newChatAddress}
              onChange={(e) => setNewChatAddress(e.target.value)}
              className={styles.modalInput}
            />
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowNewChat(false)}
                className={`${styles.modalButton} ${styles.modalButtonCancel}`}
              >
                Cancel
              </button>
              <button
                onClick={handleNewConversation}
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
