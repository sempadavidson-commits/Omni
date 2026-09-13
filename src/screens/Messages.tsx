import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  ArrowLeft,
  Send,
  Image as ImageIcon,
  CheckCheck,
  MessageCircle,
  Paperclip,
  Users,
  X,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { Conversation, Message, User } from '../types';

export function Messages({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { currentUser, requireAuth, refreshUnreadCount } = useAppContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // New Chat Dialog State
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const fetchConversations = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentUser]);

  // Listen to SSE real-time events for incoming messages
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (e) => {
      try {
        const eventData = JSON.parse(e.data);
        if (eventData.type === 'NEW_MESSAGE') {
          // If active chat is this conversation, append
          if (activeConversation && activeConversation.id === eventData.conversationId) {
            setMessages(prev => {
              if (prev.some(m => m.id === eventData.message.id)) return prev;
              return [...prev, eventData.message];
            });
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }
          // Refresh conversation list to update last message & unread badge
          fetchConversations();
          refreshUnreadCount();
        }
      } catch (err) {}
    };
    return () => {
      eventSource.close();
    };
  }, [activeConversation]);

  // Fetch messages when a conversation is opened
  const openConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 50);
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  // Search users for New Chat
  useEffect(() => {
    if (!searchUserQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/search?filter=users&q=${encodeURIComponent(searchUserQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Exclude self
          const filtered = (data.users || []).filter((u: User) => u.id !== currentUser?.id);
          setUserSearchResults(filtered);
        }
      } catch (e) {} finally {
        setIsSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchUserQuery, currentUser?.id]);

  const handleStartConversationWithUser = async (targetUser: User) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: targetUser.id })
      });
      if (res.ok) {
        const conv = await res.json();
        setIsNewChatOpen(false);
        setSearchUserQuery('');
        await fetchConversations();
        await openConversation(conv);
      }
    } catch (e) {
      console.error('Error starting conversation:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation || !messageText.trim() || isSending) return;
    const textToSend = messageText.trim();
    setMessageText('');
    setIsSending(true);

    const tempMessage: Message = {
      id: crypto.randomUUID(),
      conversationId: activeConversation.id,
      senderId: currentUser?.id || 'me',
      text: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSend })
      });
      if (res.ok) {
        const savedMessage = await res.json();
        setMessages(prev => prev.map(m => m.id === tempMessage.id ? savedMessage : m));
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            text: isVideo ? 'Shared a video' : 'Shared an image',
            mediaUrl: base64Url,
            mediaType: isVideo ? 'video' : 'image'
          })
        });
        if (res.ok) {
          const savedMsg = await res.json();
          setMessages(prev => [...prev, savedMsg]);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      } catch (err) {
        console.error('Failed to upload media:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // View: Active Chat
  if (activeConversation) {
    const partner = activeConversation.otherUser || activeConversation.recipient;
    return (
      <div className="flex flex-col h-full bg-[#07080c] relative z-30">
        {/* Chat Header */}
        <header className="px-4 py-3 border-b  flex items-center justify-between bg-[#07080c]/90  shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveConversation(null)}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <img
                src={partner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=partner'}
                alt={partner?.displayName || 'User'}
                className="w-9 h-9 rounded-full object-cover "
              />
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {partner?.displayName || 'Omni Creator'}
                </h3>
                <span className="text-[11px] text-cyan-400 font-medium">
                  @{partner?.username || 'user'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Message Stream */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-24 hide-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10  flex items-center justify-center text-cyan-400 mb-2">
                <MessageSquare size={22} />
              </div>
              <p className="text-sm font-semibold text-white">Encrypted Conversation</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Say hello to @{partner?.username}! Messages are synced across your devices.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === currentUser?.id;
              return (
                <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-2.5 shadow-md break-words",
                      isMe
                        ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-br-sm"
                        : "bg-white/[0.07]  text-slate-100 rounded-bl-sm"
                    )}
                  >
                    {m.mediaUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden max-h-60 border-black/20">
                        {m.mediaType === 'video' ? (
                          <video src={m.mediaUrl} controls className="w-full object-cover" />
                        ) : (
                          <img src={m.mediaUrl} alt="Attached media" className="w-full object-cover" />
                        )}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <span
                      className={cn(
                        "text-[10px] block mt-1",
                        isMe ? "text-cyan-100/70 text-right" : "text-slate-400"
                      )}
                    >
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Chat Input Dock */}
        <footer className="absolute bottom-0 left-0 right-0 p-3 pb-safe bg-[#07080c]/95 border-t border-white/[0.06]">
          <div className="flex items-end gap-2 bg-white/[0.05] rounded-3xl p-1.5 pl-3 border border-white/[0.05] focus-within:border-cyan-400/50 transition-colors shadow-inner">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 -ml-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 mb-0.5"
            >
              <Paperclip size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleMediaUpload}
              className="hidden"
              accept="image/*,video/*"
            />
            
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message..."
              className="flex-1 bg-transparent text-white text-sm max-h-32 min-h-[40px] py-2.5 resize-none outline-none placeholder-slate-500"
              rows={1}
            />

            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || isSending}
              className="p-2.5 rounded-full bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-50 disabled:bg-white/10 disabled:text-slate-500 transition-all shrink-0 mb-0.5"
            >
              <Send size={18} className={isSending ? 'animate-pulse' : ''} />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // View: Conversations List
  return (
    <div className="flex flex-col h-full bg-[#07080c]">
      {!hideHeader && (
        <header className="px-4 py-3.5 border-b  flex items-center justify-between bg-[#07080c]/90 ">
          <h2 className="text-lg font-bold text-white">Direct Messages</h2>
          <button
            onClick={() => {
              requireAuth('New Message', 'Sign in to start a direct message.', () => {
                setIsNewChatOpen(true);
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.3)]"
          >
            <Plus size={15} strokeWidth={3} />
            New Chat
          </button>
        </header>
      )}

      {/* List Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-3 pb-24">
        {loading ? (
          <div className="flex flex-col gap-3 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-12 h-12 rounded-full bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="w-28 h-3.5 rounded bg-white/[0.05]" />
                  <div className="w-48 h-3 rounded bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length > 0 ? (
          conversations.map((conv) => {
            const partner = conv.otherUser || conv.recipient;
            return (
              <div
                key={conv.id}
                onClick={() => openConversation(conv)}
                className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer border-transparent hover:border-white/[0.06] mb-1"
              >
                <div className="relative w-12 h-12 shrink-0">
                  <img
                    src={partner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=partner'}
                    alt={partner?.displayName || 'User'}
                    className="w-full h-full rounded-full object-cover bg-slate-800 "
                  />
                  {(conv.unreadCount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-white truncate">
                      {partner?.displayName || 'Omni Creator'}
                    </span>
                    {conv.lastMessageAt && (
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {conv.lastMessageText || 'Tap to view conversation'}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10  flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No messages yet</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-5">
              Direct message any creator on Omni to collaborate, share feedback, and chat.
            </p>
            <button
              onClick={() => {
                requireAuth('New Message', 'Sign in to start a direct message.', () => {
                  setIsNewChatOpen(true);
                });
              }}
              className="px-5 py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
            >
              Start a Conversation
            </button>
          </div>
        )}
      </main>

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80  p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0f1118]  p-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b  mb-3">
              <h3 className="font-bold text-white text-base">New Message</h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white/[0.05] rounded-xl px-3 py-2  mb-3">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="Search creator by name or @handle..."
                className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-1">
              {isSearchingUsers ? (
                <div className="text-center py-6 text-xs text-slate-500">Searching creators...</div>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartConversationWithUser(user)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
                  >
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover bg-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-white truncate">
                        {user.displayName}
                      </div>
                      <div className="text-[11px] text-cyan-400 truncate">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                ))
              ) : searchUserQuery.trim() ? (
                <div className="text-center py-6 text-xs text-slate-500">No users found matching "{searchUserQuery}"</div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">Type a username to start chatting</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
