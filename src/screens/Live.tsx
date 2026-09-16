import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Radio,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Mic,
  MicOff,
  UserPlus,
  Palette,
  Trophy,
  Flame,
  Award,
  Shield,
  Eye,
  Send,
  X,
  FlipHorizontal,
  Cast,
  CheckCircle,
  Smile,
  Zap,
  Gift
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { LiveSession, LiveParticipant, LiveMessage, LiveMilestone, UserLiveStats, User } from '../types';

interface FloatingHeart {
  id: number;
  x: number;
  color: string;
}

const BEAUTY_FILTERS = [
  { id: 'none', name: 'Natural', css: '' },
  { id: 'glow', name: 'Velvet Glow', css: 'brightness(1.12) contrast(1.05) saturate(1.18)' },
  { id: 'radiant', name: 'Radiant Warm', css: 'sepia(0.15) saturate(1.3) contrast(1.08)' },
  { id: 'cyber', name: 'Cyber Neon', css: 'hue-rotate(15deg) contrast(1.2) saturate(1.4)' },
  { id: 'porcelain', name: 'Porcelain Soft', css: 'brightness(1.18) contrast(0.96) saturate(1.1)' },
  { id: 'mono', name: 'Studio Noir', css: 'grayscale(1) contrast(1.3)' },
];

export function Live() {
  const navigate = useNavigate();
  const { currentUser, requireAuth } = useAppContext();

  // Mode: 'browse' | 'broadcast' | 'watch' | 'milestones'
  const [viewMode, setViewMode] = useState<'browse' | 'broadcast' | 'watch' | 'milestones'>('browse');

  // Active watching session
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);

  // Live broadcast setup
  const [streamTitle, setStreamTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Creative');
  const [activeBeautyFilter, setActiveBeautyFilter] = useState('glow');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCasting, setIsCasting] = useState(false);

  // Live Hardware camera ref
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // In-session interactivity
  const [sessionLikes, setSessionLikes] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [inputComment, setInputComment] = useState('');
  const [viewerCount, setViewerCount] = useState(1);

  // Co-hosting / Guests
  const [coHostGuest, setCoHostGuest] = useState<LiveParticipant | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isGuestMutedByHost, setIsGuestMutedByHost] = useState(false);

  // User Live Stats & Solid Gradient Milestones
  const [liveStats, setLiveStats] = useState<UserLiveStats>({
    livesDid: 0,
    totalLiveViews: 0,
    totalLiveLikes: 0,
    totalLiveDurationSec: 0,
    milestones: [
      {
        id: 'm1',
        title: 'Broadcast Debut',
        description: 'Complete your first live stream broadcast on Nexus',
        isUnlocked: false,
        iconName: '🚀',
        progress: 0,
        target: 1,
      },
      {
        id: 'm2',
        title: 'Rising Star',
        description: 'Reach 500 total live stream viewers',
        isUnlocked: false,
        iconName: '⭐',
        progress: 0,
        target: 500,
      },
      {
        id: 'm3',
        title: 'Crowd Magnet',
        description: 'Accumulate 2,500 live hearts from fans',
        isUnlocked: false,
        iconName: '❤️',
        progress: 0,
        target: 2500,
      },
      {
        id: 'm4',
        title: 'Co-Host Virtuoso',
        description: 'Invite and broadcast with 3 live guest creators',
        isUnlocked: false,
        iconName: '🎙️',
        progress: 0,
        target: 3,
      },
      {
        id: 'm5',
        title: 'Diamond Broadcaster',
        description: 'Complete 10 live sessions to earn the Diamond Creator badge',
        isUnlocked: false,
        iconName: '👑',
        progress: 0,
        target: 10,
      },
    ],
  });

  // Active community streams (Starts empty; only populates when real streams exist)
  const [activeSessionsList, setActiveSessionsList] = useState<LiveSession[]>([]);

  // Rebind video preview stream whenever view mode changes or active session starts
  useEffect(() => {
    if (streamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [viewMode, activeSession]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn('Camera preview not available:', e);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleStartBroadcastMode = () => {
    requireAuth('Go Live', 'Sign in to start your live broadcast on Nexus.', () => {
      setViewMode('broadcast');
      startCamera();
    });
  };

  const handleGoLiveNow = () => {
    const hostUser: User = currentUser || {
      id: 'me',
      username: 'creator',
      displayName: 'Creator',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=live',
    };

    const mySession: LiveSession = {
      id: 'live_' + Date.now(),
      hostId: hostUser.id,
      host: hostUser,
      title: streamTitle.trim() || 'Nexus Live Broadcast',
      category: selectedCategory,
      viewersCount: 1,
      likesCount: 0,
      startedAt: new Date().toISOString(),
      isLive: true,
      guests: [],
    };

    setActiveSession(mySession);
    setViewerCount(1);
    setSessionLikes(0);
    setLiveMessages([
      {
        id: 'msg_welcome',
        liveId: mySession.id,
        userId: 'system',
        username: 'Nexus Stream',
        displayName: 'Nexus',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nexus',
        text: '🎉 Welcome to your live stream! Invite friends or viewers to join as co-hosts.',
        createdAt: new Date().toISOString(),
      }
    ]);
    setViewMode('watch');
  };

  const handleWatchStream = (session: LiveSession) => {
    setActiveSession(session);
    setSessionLikes(session.likesCount || 0);
    setViewerCount(session.viewersCount || 1);
    setLiveMessages([]);
    setViewMode('watch');
  };

  const lastTapRef = useRef<number>(0);
  const handleTouchZone = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      triggerHeartBurst(e);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const triggerHeartBurst = (e?: any) => {
    const heartColors = ['#f43f5e', '#ec4899', '#06b6d4', '#a855f7', '#eab308'];
    const randomColor = heartColors[Math.floor(Math.random() * heartColors.length)];
    const randomX = e && 'clientX' in e ? e.clientX : 100 + Math.random() * 150;

    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: randomX,
      color: randomColor,
    };

    setFloatingHearts((prev) => [...prev.slice(-15), newHeart]);
    setSessionLikes((prev) => prev + 1);

    setLiveStats((prev) => {
      const newLikes = prev.totalLiveLikes + 1;
      const updatedMilestones = prev.milestones.map(m => {
        if (m.id === 'm3') {
          return {
            ...m,
            progress: Math.min(m.target, newLikes),
            isUnlocked: newLikes >= m.target
          };
        }
        return m;
      });
      return {
        ...prev,
        totalLiveLikes: newLikes,
        milestones: updatedMilestones
      };
    });
  };

  const handleSendLiveComment = () => {
    if (!inputComment.trim() || !currentUser || !activeSession) return;
    const newMsg: LiveMessage = {
      id: 'lmsg_' + Date.now(),
      liveId: activeSession.id,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
      text: inputComment.trim(),
      createdAt: new Date().toISOString(),
    };
    setLiveMessages((prev) => [...prev, newMsg]);
    setInputComment('');
  };

  const handleInviteUser = (username: string, displayName: string, avatar: string) => {
    setIsInviteModalOpen(false);
    setTimeout(() => {
      const newGuest: LiveParticipant = {
        id: 'guest_' + Date.now(),
        username,
        displayName,
        avatar,
        role: 'guest',
        isMuted: false,
        isVideoEnabled: true,
        joinedAt: new Date().toISOString(),
      };
      setCoHostGuest(newGuest);
      if (activeSession) {
        setLiveMessages((prev) => [
          ...prev,
          {
            id: 'sys_' + Date.now(),
            liveId: activeSession.id,
            userId: 'system',
            username: 'system',
            displayName: 'Nexus Live',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nexus',
            text: `🎙️ @${username} joined as co-host!`,
            createdAt: new Date().toISOString(),
          }
        ]);
      }
    }, 1200);
  };

  const toggleGuestMute = () => {
    setIsGuestMutedByHost((prev) => !prev);
    if (coHostGuest) {
      setCoHostGuest({
        ...coHostGuest,
        isMuted: !isGuestMutedByHost,
      });
    }
  };

  const activeBeautyCss = BEAUTY_FILTERS.find((f) => f.id === activeBeautyFilter)?.css || '';

  // 1. LIVE MILESTONES & JOURNEY TAB
  if (viewMode === 'milestones') {
    return (
      <div className="flex flex-col h-full w-full bg-[#07080c] text-white overflow-hidden">
        <header className="pt-safe px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#07080c]/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setViewMode('browse')}
              className="p-2 -ml-2 text-slate-300 hover:text-white rounded-full hover:bg-white/[0.08]"
            >
              <ArrowLeft size={19} />
            </button>
            <h2 className="text-base font-bold text-white">Live Journey & Milestones</h2>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-6 pb-24">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Lives Did</span>
              <span className="text-xl font-black text-cyan-400">{liveStats.livesDid}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Live Views</span>
              <span className="text-xl font-black text-indigo-400">{liveStats.totalLiveViews.toLocaleString()}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Live Hearts</span>
              <span className="text-xl font-black text-rose-400">{liveStats.totalLiveLikes.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" /> Broadcaster Milestones
              </h3>
              <span className="text-xs text-cyan-400 font-bold">
                {liveStats.milestones.filter((m) => m.isUnlocked).length} / {liveStats.milestones.length} Unlocked
              </span>
            </div>

            {liveStats.milestones.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'p-3.5 rounded-2xl border transition-all flex items-start gap-3.5',
                  m.isUnlocked
                    ? 'bg-cyan-500/[0.06] border-cyan-500/20'
                    : 'bg-white/[0.02] border-white/[0.04] opacity-75'
                )}
              >
                <div className="text-2xl p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] shrink-0">
                  {m.iconName}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-sm font-bold text-white truncate">{m.title}</h4>
                    {m.isUnlocked ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} /> Unlocked
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {m.progress} / {m.target}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-2">{m.description}</p>

                  <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        m.isUnlocked ? 'bg-gradient-to-r from-cyan-400 to-indigo-500' : 'bg-slate-500'
                      )}
                      style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 2. BROADCAST SETUP
  if (viewMode === 'broadcast') {
    return (
      <div className="flex flex-col h-full w-full bg-[#07080c] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-black">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            style={{ filter: activeBeautyCss }}
            className="w-full h-full object-cover"
          />
        </div>

        <header className="relative z-20 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={() => {
              stopCamera();
              setViewMode('browse');
            }}
            className="p-2 -ml-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMode = facingMode === 'user' ? 'environment' : 'user';
                setFacingMode(nextMode);
                startCamera();
              }}
              className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md"
              title="Flip Camera"
            >
              <FlipHorizontal size={17} />
            </button>

            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              className={cn(
                'p-2.5 rounded-full backdrop-blur-md transition-colors',
                isMicMuted ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'
              )}
              title="Mute Mic"
            >
              {isMicMuted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          </div>
        </header>

        <div className="relative z-20 flex-1 flex flex-col justify-end p-4 pb-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent space-y-4">
          <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 space-y-2">
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Add an engaging title for your live stream..."
              className="w-full bg-transparent text-sm font-bold text-white placeholder-slate-400 outline-none"
            />
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {['Creative', 'Music', 'Chat & Chill', 'Gaming', 'Tech'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                    selectedCategory === cat ? 'bg-cyan-400 text-black' : 'bg-white/10 text-slate-300'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Palette size={12} className="text-cyan-400" /> Beauty & Lighting Filters
            </span>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
              {BEAUTY_FILTERS.map((bf) => (
                <button
                  key={bf.id}
                  onClick={() => setActiveBeautyFilter(bf.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap backdrop-blur-md border transition-all',
                    activeBeautyFilter === bf.id
                      ? 'border-cyan-400 bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                      : 'border-white/10 bg-black/50 text-slate-200 hover:border-white/20'
                  )}
                >
                  {bf.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGoLiveNow}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white font-extrabold text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(244,63,94,0.4)] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Radio size={18} className="animate-pulse" />
            <span>Go Live Now</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. ACTIVE LIVE STREAM VIEW
  if (viewMode === 'watch' && activeSession) {
    const isMeHost = activeSession.hostId === currentUser?.id;

    return (
      <div
        className="flex flex-col h-full w-full bg-black text-white relative overflow-hidden select-none"
        onClick={handleTouchZone}
      >
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <AnimatePresence>
            {floatingHearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 1, y: '80vh', scale: 0.8, x: h.x - 20 }}
                animate={{
                  opacity: 0,
                  y: '15vh',
                  scale: 1.4,
                  x: h.x - 20 + Math.sin(h.id) * 40,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                className="absolute"
              >
                <Heart size={32} fill={h.color} color={h.color} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="absolute inset-0 z-0 flex flex-col md:flex-row bg-[#080910]">
          <div className={cn('relative w-full h-full flex items-center justify-center', coHostGuest ? 'h-1/2 md:h-full md:w-1/2 border-b md:border-r border-white/10' : 'h-full')}>
            {isMeHost ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                style={{ filter: activeBeautyCss }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-[#111422] to-[#1c142c]">
                <img
                  src={activeSession.host.avatar}
                  alt={activeSession.host.displayName}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
              </div>
            )}

            <div className="absolute top-16 left-4 z-10 flex items-center gap-2 p-1.5 pr-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              <img
                src={activeSession.host.avatar}
                alt={activeSession.host.displayName}
                className="w-7 h-7 rounded-full object-cover border border-cyan-400"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate leading-tight">
                  {activeSession.host.displayName}
                </span>
                <span className="text-[10px] text-cyan-400 block truncate leading-none">
                  @{activeSession.host.username}
                </span>
              </div>
            </div>
          </div>

          {coHostGuest && (
            <div className="relative w-full h-1/2 md:h-full md:w-1/2 flex items-center justify-center bg-[#0d0f1a] overflow-hidden">
              <img
                src={coHostGuest.avatar}
                alt={coHostGuest.displayName}
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-1.5 pr-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                <img
                  src={coHostGuest.avatar}
                  alt={coHostGuest.displayName}
                  className="w-6 h-6 rounded-full object-cover border border-indigo-400"
                />
                <span className="text-xs font-bold text-white truncate">
                  {coHostGuest.displayName} (Guest)
                </span>
                {coHostGuest.isMuted && (
                  <span className="p-1 rounded-full bg-rose-500/30 text-rose-300">
                    <MicOff size={12} />
                  </span>
                )}
              </div>

              {isMeHost && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGuestMute();
                  }}
                  className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-slate-200 hover:bg-black/80 flex items-center gap-1.5"
                >
                  {isGuestMutedByHost ? <MicOff size={13} className="text-rose-400" /> : <Mic size={13} className="text-cyan-400" />}
                  <span>{isGuestMutedByHost ? 'Unmute Guest' : 'Mute Guest'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <header className="relative z-20 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.6)]">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              LIVE
            </span>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs text-slate-200">
              <Eye size={13} className="text-cyan-400" />
              <span>{viewerCount}</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCasting(!isCasting);
              }}
              className={cn(
                'p-2 rounded-full backdrop-blur-md transition-colors',
                isCasting ? 'bg-cyan-400 text-black' : 'bg-black/50 text-white hover:bg-black/70'
              )}
              title="Cast to Device / Screen"
            >
              <Cast size={18} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                stopCamera();
                if (activeSession && activeSession.hostId === (currentUser?.id || 'me')) {
                  setLiveStats((prev) => {
                    const newLivesDid = prev.livesDid + 1;
                    const updatedMilestones = prev.milestones.map(m => {
                      if (m.id === 'm1' || m.id === 'm5') {
                        return {
                          ...m,
                          progress: Math.min(m.target, newLivesDid),
                          isUnlocked: newLivesDid >= m.target
                        };
                      }
                      return m;
                    });
                    return {
                      ...prev,
                      livesDid: newLivesDid,
                      milestones: updatedMilestones
                    };
                  });
                }
                setViewMode('browse');
                setActiveSession(null);
              }}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-rose-500/80 backdrop-blur-md transition-colors"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="relative z-20 flex-1 flex flex-col justify-end p-4 pb-20 pointer-events-none">
          <div className="max-h-48 overflow-y-auto hide-scrollbar space-y-2 mb-3 pointer-events-auto max-w-xs">
            {liveMessages.map((msg) => (
              <div
                key={msg.id}
                className="px-3 py-1.5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/[0.08] text-xs text-slate-100 flex items-start gap-2 shadow-lg animate-in fade-in slide-in-from-bottom-2"
              >
                <span className="font-bold text-cyan-400 shrink-0">
                  {msg.displayName || msg.username}:
                </span>
                <span className="text-slate-200 leading-snug break-words">{msg.text}</span>
              </div>
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-2 w-full">
            <div className="flex-1 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-white/10">
              <input
                type="text"
                value={inputComment}
                onChange={(e) => setInputComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendLiveComment();
                }}
                placeholder="Send a message in live chat..."
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 outline-none"
              />
              <button
                onClick={handleSendLiveComment}
                disabled={!inputComment.trim()}
                className="text-cyan-400 disabled:opacity-40 p-1 hover:scale-105 transition-transform"
              >
                <Send size={15} />
              </button>
            </div>

            {isMeHost && !coHostGuest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInviteModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-indigo-600/80 hover:bg-indigo-600 backdrop-blur-md text-white shadow-lg active:scale-95 transition-all"
                title="Invite Co-host Guest"
              >
                <UserPlus size={18} />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHeartBurst(e);
              }}
              className="p-3 rounded-2xl bg-rose-500/80 hover:bg-rose-500 backdrop-blur-md text-white shadow-lg active:scale-95 transition-all relative"
              title="Double tap screen or tap heart to like"
            >
              <Heart size={18} className="fill-white" />
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-white text-rose-600 font-extrabold text-[9px] shadow-sm">
                {sessionLikes}
              </span>
            </button>
          </div>
        </div>

        {isInviteModalOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#0e111a] border border-white/10 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus size={16} className="text-cyan-400" /> Invite Active Co-Host
                </h3>
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Active creators in the app can be invited to split-screen co-host with you.
              </p>

              <div className="space-y-2">
                {[
                  {
                    username: 'cyber_echo',
                    displayName: 'Echo Synthetics',
                    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
                  },
                  {
                    username: 'solaris_design',
                    displayName: 'Solaris Motion',
                    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
                  },
                ].map((user) => (
                  <div
                    key={user.username}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">{user.displayName}</span>
                        <span className="text-[10px] text-cyan-400 block">@{user.username}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleInviteUser(user.username, user.displayName, user.avatar)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-sm active:scale-95"
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. DEFAULT: BROWSE ACTIVE LIVES
  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white overflow-hidden">
      <header className="pt-safe px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#07080c]/90 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 text-slate-300 hover:text-white rounded-full hover:bg-white/[0.08]"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <h1 className="text-base font-extrabold tracking-wider uppercase text-white">Live Broadcasts</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('milestones')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-200 text-xs font-bold transition-all border border-white/[0.08]"
          >
            <Trophy size={13} className="text-amber-400" />
            <span>Milestones</span>
          </button>

          <button
            onClick={handleStartBroadcastMode}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold text-xs hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)]"
          >
            <Radio size={14} />
            <span>Go Live</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4 pb-24">
        <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/20 via-pink-500/10 to-indigo-500/20 border border-rose-500/30 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 block mb-0.5">
              Nexus Live Studio
            </span>
            <h3 className="text-sm font-extrabold text-white">Broadcast & Co-Host with Creators</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xs">
              Stream in high definition, invite guests to co-host, and collect live hearts.
            </p>
          </div>
          <button
            onClick={handleStartBroadcastMode}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            Start Stream
          </button>
        </div>

        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
          Active Live Channels
        </h3>

        {activeSessionsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl bg-white/[0.02]">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
              <Radio size={28} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">No Active Live Streams</h4>
            <p className="text-xs text-slate-400 mb-5 max-w-xs">
              Be the first to go live and share your content with the Nexus community!
            </p>
            <button
              onClick={handleStartBroadcastMode}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(244,63,94,0.4)]"
            >
              Start Live Broadcast
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeSessionsList.map((session) => (
              <div
                key={session.id}
                onClick={() => handleWatchStream(session)}
                className="group relative rounded-3xl overflow-hidden bg-[#0e111a] hover:brightness-110 transition-all cursor-pointer shadow-xl aspect-[16/10] flex flex-col justify-between p-3.5"
              >
                <img
                  src={session.host.avatar}
                  alt={session.host.displayName}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-slate-200">
                    <Eye size={11} className="text-cyan-400" />
                    <span>{session.viewersCount}</span>
                  </div>
                </div>

                <div className="relative z-10 space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                    {session.category}
                  </span>
                  <h4 className="text-xs font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                    {session.title}
                  </h4>

                  <div className="flex items-center gap-2 pt-1">
                    <img
                      src={session.host.avatar}
                      alt={session.host.displayName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-xs text-slate-300 font-semibold truncate">
                      {session.host.displayName}
                    </span>
                    {session.guests.length > 0 && (
                      <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-full ml-auto">
                        Co-Hosting
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
