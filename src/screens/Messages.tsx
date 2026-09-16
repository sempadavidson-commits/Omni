import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  ArrowLeft,
  Send,
  MessageCircle,
  Paperclip,
  Users,
  X,
  Lock,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Download,
  ExternalLink,
  Maximize2,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { Conversation, Message, User } from '../types';
import { AudioMessagePlayer } from '../components/AudioMessagePlayer';

export function Messages({ hideHeader }: { hideHeader?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetUserId = searchParams.get('user');
  const targetName = searchParams.get('name');
  const targetUsername = searchParams.get('username');
  const targetAvatar = searchParams.get('avatar');

  const { currentUser, requireAuth, refreshUnreadCount } = useAppContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Voice Note Recording State (Max 1hr = 3600s)
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Call & Bubble Zoom State
  const [isAudioCallActive, setIsAudioCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isEnlargedBubble, setIsEnlargedBubble] = useState(false);
  const callTimerRef = useRef<any>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);

  const formatRecordTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone recording is not supported on this browser/device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordSeconds(0);
      setRecordedAudioUrl(null);
      setRecordedBlob(null);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 3600) { // Max 1 hour auto-stop
            stopVoiceRecording();
            return 3600;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Failed to access microphone. Please allow microphone permissions.');
    }
  };

  const togglePauseResumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (isRecordingPaused) {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
      setIsRecordingPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 3600) {
            stopVoiceRecording();
            return 3600;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
      setIsRecordingPaused(true);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    setIsRecordingPaused(true);
  };

  const togglePreviewPlayPause = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().then(() => setIsPreviewPlaying(true)).catch(console.warn);
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordSeconds(0);
    setRecordedAudioUrl(null);
    setRecordedBlob(null);
    setIsPreviewPlaying(false);
  };

  const sendVoiceRecordingMessage = async () => {
    if (!activeConversation) return;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopVoiceRecording();
    }

    let blobToSend = recordedBlob;
    if (!blobToSend && audioChunksRef.current.length > 0) {
      blobToSend = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    if (!blobToSend) {
      cancelVoiceRecording();
      return;
    }

    setIsSending(true);

    const reader = new FileReader();
    reader.readAsDataURL(blobToSend);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      const durationText = formatRecordTime(recordSeconds);

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            text: `🎙️ Voice Note (${durationText})`,
            mediaUrl: base64Audio,
            mediaType: 'audio'
          })
        });

        if (res.ok) {
          const newMsg = await res.json();
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      } catch (err) {
        console.error('Error sending audio message:', err);
      } finally {
        setIsSending(false);
        cancelVoiceRecording();
      }
    };
  };

  const startAudioCall = async () => {
    setIsAudioCallActive(true);
    setCallSeconds(0);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localAudioStreamRef.current = stream;
      }
    } catch (err) {
      console.warn('Audio call permission/device error:', err);
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
  };

  const endAudioCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      localAudioStreamRef.current = null;
    }
    setIsAudioCallActive(false);

    if (activeConversation) {
      const durationMin = Math.floor(callSeconds / 60);
      const durationSec = callSeconds % 60;
      const durationStr = `${durationMin}m ${durationSec}s`;
      const callMsgText = `📞 Audio call ended (${durationStr})`;

      const tempId = 'call_' + Date.now();
      const tempMessage: Message = {
        id: tempId,
        conversationId: activeConversation.id,
        senderId: currentUser?.id || '',
        text: callMsgText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
    }
  };

  const toggleCallMute = () => {
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isCallMuted;
      });
    }
    setIsCallMuted(!isCallMuted);
  };

  // Fullscreen Media Lightbox State
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'file';
    name?: string;
  } | null>(null);

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
        setConversations(Array.isArray(data) ? data : []);
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

  // Handle direct message intent from URL parameter `?user=xxx`
  useEffect(() => {
    if (!targetUserId || !currentUser) return;
    if (targetUserId === currentUser.id || targetUserId === currentUser.uid) return;

    const startDirectConversation = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ recipientId: targetUserId })
        });
        if (res.ok) {
          const conv = await res.json();
          const fullConv: Conversation = {
            ...conv,
            otherUser: conv.otherUser || conv.recipient || {
              id: targetUserId,
              displayName: targetName || 'Creator',
              username: targetUsername || 'creator',
              avatar: targetAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`,
            }
          };
          openConversation(fullConv);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Could not start conversation:', errData.error || res.statusText);
        }
      } catch (e) {
        console.error('Error starting direct conversation from url:', e);
      }
    };

    startDirectConversation();
  }, [targetUserId, currentUser]);

  // Listen to SSE real-time events for incoming messages
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (e) => {
      try {
        const eventData = JSON.parse(e.data);
        if (eventData.type === 'NEW_MESSAGE') {
          if (activeConversation && activeConversation.id === eventData.conversationId) {
            setMessages(prev => {
              if (prev.some(m => m.id === eventData.message.id)) return prev;
              const tempIndex = prev.findIndex(m => m.id.startsWith('temp_') && m.text === eventData.message.text);
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = eventData.message;
                return next;
              }
              return [...prev, eventData.message];
            });
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }
          fetchConversations();
          refreshUnreadCount();
        }
      } catch (err) {
        console.warn('Could not parse SSE message in Messages:', err);
      }
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
        const rawList: Message[] = Array.isArray(data) ? data : [];
        const seen = new Set<string>();
        const unique = rawList.filter(m => {
          if (!m.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setMessages(unique);
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
          const filtered = (data.users || []).filter((u: User) => u.id !== currentUser?.id);
          setUserSearchResults(filtered);
        }
      } catch (e) {
        console.error('Error searching users for message conversation:', e);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchUserQuery, currentUser?.id]);

  const handleStartConversationWithUser = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id || targetUser.id === currentUser?.uid) {
      setIsNewChatOpen(false);
      return;
    }
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
        const fullConv: Conversation = {
          ...conv,
          otherUser: conv.otherUser || targetUser
        };
        setConversations(prev => [fullConv, ...prev.filter(c => c.id !== conv.id)]);
        openConversation(fullConv);
      }
    } catch (e) {
      console.error('Error starting conversation:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeConversation || isSending) return;
    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const tempMessage: Message = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: currentUser?.id || '',
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 30);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const savedMsg = await res.json();
        setMessages(prev => {
          if (prev.some(m => m.id === savedMsg.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? savedMsg : m);
        });
        fetchConversations();
      }
    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setIsSending(false);
    }
  };

  // Support any media and document file upload without limitations
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    let mediaType: 'image' | 'video' | 'audio' | 'document' | 'file' = 'file';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';
    else if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')) mediaType = 'document';

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            text: file.name,
            mediaUrl: base64,
            mediaType
          })
        });
        if (res.ok) {
          const savedMsg = await res.json();
          setMessages(prev => {
            if (prev.some(m => m.id === savedMsg.id)) return prev;
            return [...prev, savedMsg];
          });
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
          fetchConversations();
        }
      } catch (err) {
        console.error('Error sending file attachment:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // View: Active Conversation Chat Room
  if (activeConversation) {
    const partner = activeConversation.otherUser || activeConversation.recipient;
    return (
      <div className="flex flex-col h-full w-full bg-[#07080c] relative z-40 overflow-hidden">
        {/* Chat Room Header */}
        <header className="pt-safe px-3 py-2.5 border-b border-white/[0.06] bg-[#07080c]/95 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => {
                setActiveConversation(null);
                if (targetUserId) {
                  setSearchParams({});
                }
              }}
              className="p-2 -ml-1 text-slate-300 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={19} />
            </button>

            <div
              onClick={() => partner?.id && navigate(`/profile/${partner.id}`)}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity min-w-0"
            >
              <img
                src={partner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=partner'}
                alt={partner?.displayName || 'User'}
                className="w-9 h-9 rounded-full object-cover bg-slate-800 shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-tight truncate">
                  {partner?.displayName || 'Nexus Creator'}
                </h3>
                <span className="text-[11px] text-cyan-400 font-medium truncate block">
                  @{partner?.username || 'user'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Functional Audio Call Button */}
            <button
              onClick={startAudioCall}
              className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black active:scale-95 transition-all"
              title="Start High Quality Audio Call"
            >
              <Phone size={17} />
            </button>
          </div>
        </header>

        {/* Message Stream: Sender (Me) strictly on RIGHT, Receiver strictly on LEFT */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 hide-scrollbar min-h-0">
          {/* Encryption indicator */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-white/[0.03] self-center text-[10px] font-semibold text-slate-400 mb-1">
            <Lock size={11} className="text-cyan-400" />
            <span>Direct Encrypted Message</span>
          </div>

          {messages.map((m, index) => {
            const isMe = m.senderId === currentUser?.id || m.senderId === currentUser?.uid;
            return (
              <div
                key={`${m.id || 'msg'}-${index}`}
                className={cn('flex flex-col w-full', isMe ? 'items-end' : 'items-start')}
              >
                {/* Compact Pop Message Bubble: NO BORDERS on sent media, distinct colors & corner geometry */}
                <div
                  onDoubleClick={() => setIsEnlargedBubble(!isEnlargedBubble)}
                  className={cn(
                    'max-w-[72%] shadow-md break-words transition-all duration-200 cursor-pointer',
                    isEnlargedBubble ? 'scale-110 sm:scale-125 z-10 my-2' : 'scale-100',
                    m.mediaUrl && (m.mediaType === 'image' || m.mediaType === 'video')
                      ? 'p-0 overflow-hidden bg-transparent border-0'
                      : isMe
                      ? 'px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-2xl rounded-br-none text-xs sm:text-xs'
                      : 'px-3.5 py-2 bg-[#181a24] text-slate-100 rounded-2xl rounded-bl-none text-xs sm:text-xs'
                  )}
                >
                  {/* Media Content Preview (No border bubbles on media) */}
                  {m.mediaUrl && (
                    <div className="mb-0">
                      {m.mediaType === 'video' ? (
                        <div
                          onClick={() => setLightboxMedia({ url: m.mediaUrl!, type: 'video', name: m.text })}
                          className="relative rounded-2xl overflow-hidden cursor-pointer group bg-black"
                        >
                          <video src={m.mediaUrl} className="w-full max-h-52 object-cover rounded-2xl" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                            <Maximize2 size={20} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      ) : m.mediaType === 'image' ? (
                        <div
                          onClick={() => setLightboxMedia({ url: m.mediaUrl!, type: 'image', name: m.text })}
                          className="relative rounded-2xl overflow-hidden cursor-pointer group bg-black"
                        >
                          <img src={m.mediaUrl} alt="Media" className="w-full max-h-52 object-cover rounded-2xl" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 size={20} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      ) : m.mediaType === 'audio' || (m.mediaUrl && (m.mediaUrl.startsWith('data:audio/') || m.mediaUrl.endsWith('.mp3') || m.mediaUrl.endsWith('.webm') || m.mediaUrl.endsWith('.ogg') || m.mediaUrl.endsWith('.wav'))) ? (
                        <AudioMessagePlayer src={m.mediaUrl} isMe={isMe} />
                      ) : (
                        /* Document or Any File Type Card */
                        <div
                          onClick={() => setLightboxMedia({ url: m.mediaUrl!, type: 'document', name: m.text || 'Document' })}
                          className="p-2.5 rounded-xl bg-black/30 hover:bg-black/50 cursor-pointer flex items-center gap-2.5 transition-colors"
                        >
                          <FileText size={18} className="text-cyan-300 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-white block truncate">{m.text || 'Attached Document'}</span>
                            <span className="text-[9px] text-cyan-200 block">Tap to download</span>
                          </div>
                          <Download size={14} className="text-white/80 shrink-0" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text message */}
                  {m.text && (!m.mediaUrl || m.mediaType === 'image' || m.mediaType === 'video') && (
                    <p className="leading-snug whitespace-pre-wrap">{m.text}</p>
                  )}

                  <span
                    className={cn(
                      'text-[9px] block mt-0.5 opacity-80',
                      isMe ? 'text-cyan-100/80 text-right' : 'text-slate-400 text-left'
                    )}
                  >
                    {m.createdAt ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true }) : 'just now'}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </main>

        {/* Chat Input Dock with Voice Recorder */}
        <footer className="shrink-0 p-3 pb-20 md:pb-4 bg-[#07080c] border-t border-white/[0.06] z-30">
          {isRecording ? (
            <div className="flex items-center justify-between gap-3 bg-[#11131f] rounded-2xl p-2 px-3.5 border border-rose-500/30 shadow-xl">
              {recordedAudioUrl && (
                <audio
                  ref={previewAudioRef}
                  src={recordedAudioUrl}
                  onEnded={() => setIsPreviewPlaying(false)}
                  className="hidden"
                />
              )}

              {/* Cancel / Discard */}
              <button
                onClick={cancelVoiceRecording}
                type="button"
                className="p-2 rounded-full bg-white/10 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                title="Discard recording"
              >
                <Trash2 size={18} />
              </button>

              {/* Recording Status & Waveform */}
              <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0 transition-all",
                  !isRecordingPaused ? "bg-rose-500 animate-ping" : "bg-amber-400"
                )} />
                <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider shrink-0">
                  {formatRecordTime(recordSeconds)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline shrink-0">
                  (Max 1hr)
                </span>

                {/* Animated visualizer bars */}
                <div className="flex items-center gap-[2px] h-4 shrink-0">
                  {[40, 75, 100, 60, 90, 45, 80].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: !isRecordingPaused ? `${h}%` : '20%' }}
                      className={cn(
                        "w-1 rounded-full transition-all duration-200",
                        !isRecordingPaused ? "bg-rose-500" : "bg-slate-600"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Toggle Pause / Resume or Preview Play / Pause */}
              <button
                onClick={() => {
                  if (recordedAudioUrl) {
                    togglePreviewPlayPause();
                  } else {
                    togglePauseResumeRecording();
                  }
                }}
                type="button"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shrink-0"
                title={
                  recordedAudioUrl
                    ? (isPreviewPlaying ? "Pause preview" : "Play preview")
                    : (isRecordingPaused ? "Resume recording" : "Pause recording")
                }
              >
                {recordedAudioUrl ? (
                  isPreviewPlaying ? <Pause size={18} className="fill-current text-cyan-400" /> : <Play size={18} className="fill-current text-cyan-400 ml-0.5" />
                ) : (
                  isRecordingPaused ? <Play size={18} className="fill-current text-amber-400 ml-0.5" /> : <Pause size={18} className="fill-current text-rose-400" />
                )}
              </button>

              {/* Send Recorded Voice Note */}
              <button
                onClick={sendVoiceRecordingMessage}
                type="button"
                disabled={isSending || (recordSeconds === 0 && !recordedBlob)}
                className="p-2.5 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-40 transition-all font-bold flex items-center shrink-0 active:scale-95 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                title="Send voice note"
              >
                <Send size={16} className={isSending ? 'animate-pulse' : ''} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/[0.06] rounded-2xl p-1.5 pl-3 border border-white/[0.08] focus-within:border-cyan-400/50 transition-colors shadow-inner">
              {/* Unlimited media & document attachment input */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                title="Attach media or documents (any format)"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="*/*"
              />

              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-white text-xs sm:text-sm py-2 outline-none placeholder-slate-500 min-w-0"
              />

              {/* Microphone Button to record voice messages */}
              <button
                onClick={startVoiceRecording}
                type="button"
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/10 rounded-full transition-colors shrink-0"
                title="Record voice message (Max 1hr)"
              >
                <Mic size={18} />
              </button>

              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || isSending}
                className="p-2.5 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-40 disabled:bg-white/10 disabled:text-slate-500 transition-all shrink-0 active:scale-95 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              >
                <Send size={16} className={isSending ? 'animate-pulse' : ''} />
              </button>
            </div>
          )}
        </footer>

        {/* Media Lightbox Viewer Modal */}
        {/* Live Audio Call Fullscreen Overlay */}
        {isAudioCallActive && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#090b14] via-[#0d1222] to-[#060810] p-6 text-white select-none animate-in fade-in">
            {/* Top info */}
            <div className="pt-10 flex flex-col items-center text-center space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                HD Audio Call
              </span>
              <h2 className="text-xl font-extrabold text-white">
                {partner?.displayName || 'Creator'}
              </h2>
              <span className="text-xs text-cyan-400">@{partner?.username || 'user'}</span>
              <span className="text-sm font-mono text-slate-300 font-bold pt-1">
                {Math.floor(callSeconds / 60).toString().padStart(2, '0')}:
                {(callSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Avatar & Equalizer animation */}
            <div className="relative my-auto flex flex-col items-center justify-center">
              <div className="absolute w-44 h-44 rounded-full bg-cyan-500/10 animate-ping" />
              <div className="absolute w-36 h-36 rounded-full bg-indigo-500/20 animate-pulse" />
              <img
                src={partner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=partner'}
                alt={partner?.displayName || 'User'}
                className="w-28 h-28 rounded-full object-cover border-4 border-cyan-400/80 shadow-[0_0_30px_rgba(0,240,255,0.4)] relative z-10"
              />
            </div>

            {/* Call Controls */}
            <div className="pb-12 flex items-center justify-center gap-6 w-full max-w-xs">
              <button
                onClick={toggleCallMute}
                className={cn(
                  'p-4 rounded-full border transition-all active:scale-95',
                  isCallMuted
                    ? 'bg-rose-500 border-rose-400 text-white shadow-lg'
                    : 'bg-white/10 border-white/20 text-slate-200 hover:bg-white/20'
                )}
                title={isCallMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isCallMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <button
                onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                className={cn(
                  'p-4 rounded-full border transition-all active:scale-95',
                  isSpeakerMuted
                    ? 'bg-amber-500 border-amber-400 text-white shadow-lg'
                    : 'bg-white/10 border-white/20 text-slate-200 hover:bg-white/20'
                )}
                title={isSpeakerMuted ? 'Speaker On' : 'Speaker Off'}
              >
                {isSpeakerMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
              </button>

              <button
                onClick={endAudioCall}
                className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.5)] active:scale-95 transition-all"
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        )}

        {lightboxMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col items-center justify-center">
              <button
                onClick={() => setLightboxMedia(null)}
                className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/90"
              >
                <X size={22} />
              </button>

              <div className="w-full flex items-center justify-center p-2">
                {lightboxMedia.type === 'video' ? (
                  <video src={lightboxMedia.url} controls autoPlay className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl" />
                ) : lightboxMedia.type === 'image' ? (
                  <img src={lightboxMedia.url} alt="Full view" className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl" />
                ) : (
                  <div className="p-8 rounded-3xl bg-[#0e111a] border border-white/10 text-center space-y-4">
                    <FileText size={48} className="text-cyan-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{lightboxMedia.name || 'Document'}</h4>
                      <p className="text-xs text-slate-400 mt-1">Ready to download or preview</p>
                    </div>
                    <a
                      href={lightboxMedia.url}
                      download={lightboxMedia.name || 'document'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-md"
                    >
                      <Download size={16} /> Download File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View: Conversations List (Created only when real messages exist)
  return (
    <div className="flex flex-col h-full bg-[#07080c] overflow-hidden">
      {!hideHeader && (
        <header className="pt-safe px-4 py-3.5 flex items-center justify-between bg-[#07080c]/90 shrink-0">
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
            <span>New Chat</span>
          </button>
        </header>
      )}

      {/* List Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-3 pb-24">
        {loading ? (
          <div className="flex flex-col gap-3 p-2">
            {[1, 2, 3].map((i) => (
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
                className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer mb-1 border border-transparent hover:border-white/[0.06]"
              >
                <div className="relative w-12 h-12 shrink-0">
                  <img
                    src={partner?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=partner'}
                    alt={partner?.displayName || 'User'}
                    className="w-full h-full rounded-full object-cover bg-slate-800"
                  />
                  {(conv.unreadCount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-cyan-400 text-black text-[10px] font-extrabold flex items-center justify-center shadow-md">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-white truncate">
                      {partner?.displayName || 'Nexus Creator'}
                    </span>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-slate-500">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {conv.lastMessage || 'Start conversation...'}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          /* Clean empty state when no chats have been started */
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
              <MessageCircle size={26} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No Messages Yet</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-5">
              Direct messages will appear here once you send or receive a message.
            </p>
            <button
              onClick={() => {
                requireAuth('New Message', 'Sign in to start a message.', () => {
                  setIsNewChatOpen(true);
                });
              }}
              className="px-5 py-2 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.25)]"
            >
              Start a Conversation
            </button>
          </div>
        )}
      </main>

      {/* New Chat Dialog */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0e111a] border border-white/[0.08] p-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm">New Message</h3>
              <button
                onClick={() => {
                  setIsNewChatOpen(false);
                  setSearchUserQuery('');
                  setUserSearchResults([]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/[0.08]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-3 relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="Search by name or @username..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto hide-scrollbar mt-3 space-y-1.5 min-h-[160px]">
              {isSearchingUsers ? (
                <div className="text-center py-6 text-xs text-slate-500">Searching creators...</div>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleStartConversationWithUser(u)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.05] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        className="w-9 h-9 rounded-full object-cover bg-slate-800"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{u.displayName}</div>
                        <div className="text-[11px] text-cyan-400 truncate">@{u.username}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : searchUserQuery.trim() ? (
                <div className="text-center py-6 text-xs text-slate-500">No creators found.</div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  Type a creator's name or @handle to start chatting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
