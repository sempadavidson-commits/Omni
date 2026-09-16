import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Volume2,
  VolumeX,
  Plus,
  Play,
  Bookmark,
  Music2,
  Check,
  Flag,
  AlertCircle,
  EyeOff,
  Copy,
  Zap,
  RefreshCw,
  MoreVertical,
  Pin,
  Edit3,
  Trash2,
  Scissors,
  Download,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Post } from '../types';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { CommentModal } from './comments/CommentModal';
import { HashtagParser } from './HashtagParser';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { telemetry } from '../lib/telemetry';
import { recordOfflineAction } from '../lib/feedStorage';

function ThumbnailPickerModal({
  post,
  onClose,
  onSaveThumbnail,
}: {
  post: Post;
  onClose: () => void;
  onSaveThumbnail: (url: string) => void;
}) {
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(post.thumbnailUrl || null);
  const [extracting, setExtracting] = useState(true);

  useEffect(() => {
    if (post.type !== 'video' || !post.content) {
      setExtracting(false);
      return;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = post.content;
    video.preload = 'auto';

    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = async () => {
      const duration = video.duration || 10;
      const timestamps = [0.1, 0.25, 0.5, 0.75, 0.9].map(r => r * duration);
      const extracted: string[] = [];

      for (const ts of timestamps) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            if (ctx) {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                extracted.push(dataUrl);
              } catch (e) {
                console.warn('Frame extraction canvas error:', e);
              }
            }
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = ts;
        });
      }

      setFrames(extracted);
      if (extracted.length > 0 && !selectedFrame) {
        setSelectedFrame(extracted[0]);
      }
      setExtracting(false);
    };

    video.onerror = () => {
      setExtracting(false);
    };
  }, [post.content]);

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedFrame(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#0f1118] border border-white/10 p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-cyan-400" size={18} />
            <h3 className="text-sm font-bold text-white">Select Video Cover Frame</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {extracting ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-slate-300">Extracting video frames...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-400">Choose a frame from your video to set as thumbnail cover:</p>
            <div className="grid grid-cols-5 gap-2">
              {frames.map((frame, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedFrame(frame)}
                  className={cn(
                    "aspect-[9/16] rounded-xl overflow-hidden cursor-pointer relative border-2 transition-all",
                    selectedFrame === frame ? "border-cyan-400 scale-105 shadow-[0_0_12px_#00f0ff]" : "border-transparent opacity-65 hover:opacity-100"
                  )}
                >
                  <img src={frame} alt={`Frame ${i+1}`} className="w-full h-full object-cover" />
                  {selectedFrame === frame && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center font-bold text-[10px]">
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <ImageIcon size={16} /> Upload Custom Image Cover
              <input type="file" accept="image/*" onChange={handleCustomUpload} className="hidden" />
            </label>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!selectedFrame}
                onClick={() => {
                  if (selectedFrame) onSaveThumbnail(selectedFrame);
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs transition-colors shadow-lg disabled:opacity-50"
              >
                Save Cover Frame
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditCaptionModal({
  post,
  onClose,
  onSaveCaption,
}: {
  post: Post;
  onClose: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [captionText, setCaptionText] = useState(post.caption || '');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#0f1118] border border-white/10 p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Edit3 className="text-cyan-400" size={18} />
            <h3 className="text-sm font-bold text-white">Edit Caption</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <textarea
          value={captionText}
          onChange={(e) => setCaptionText(e.target.value)}
          placeholder="Write a caption..."
          className="w-full h-28 p-3 rounded-2xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/60 resize-none"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSaveCaption(captionText)}
            className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs transition-colors shadow-lg"
          >
            Save Caption
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPostTime(dateString?: string) {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return `${Math.floor(diffSec / 604800)}w ago`;
}

interface PostCardProps {
  post: Post;
  isActive?: boolean;
  compact?: boolean;
  onHidePost?: (postId: string) => void;
}

export function PostCard({ post, isActive = true, compact = false, onHidePost }: PostCardProps) {
  const {
    requireAuth,
    currentUser,
    dispatchEvent,
    isGlobalMuted,
    setIsGlobalMuted,
    startBackgroundDownloadVideo
  } = useAppContext();
  const author = post.author || {
    id: post.authorId,
    username: 'creator',
    displayName: 'Creator',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator'
  };
  const navigate = useNavigate();

  // Optimistic states
  const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarkedByMe || false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [isFollowing, setIsFollowing] = useState<boolean>(() => {
    if (post.isFollowedByMe) return true;
    if (currentUser?.following && author?.id && currentUser.following.includes(author.id)) return true;
    return false;
  });
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isEditCaptionOpen, setIsEditCaptionOpen] = useState(false);
  const [isEditThumbnailOpen, setIsEditThumbnailOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [actionFeedbackToast, setActionFeedbackToast] = useState<string | null>(null);

  // Video playback & metrics
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // Gesture tracking (Swipe from right edge to view profile)
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // 2X Speed & Long Press Gesture States
  const [is2xActive, setIs2xActive] = useState(false);
  const speedHoldTimeoutRef = useRef<any>(null);
  const middlePressTimeoutRef = useRef<any>(null);
  const isHoldingMiddleRef = useRef(false);

  // Telemetry watch-time tracking
  const watchStartRef = useRef<number>(0);
  const totalWatchTimeRef = useRef<number>(0);

  // View count incrementing logic on the server
  const hasIncrementedViewRef = useRef<string | null>(null);

  const incrementViewCountOnServer = async () => {
    if (hasIncrementedViewRef.current === post.id) return;
    hasIncrementedViewRef.current = post.id;
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers
      });
    } catch (e) {
      console.warn('Failed to increment view count on backend:', e);
    }
  };

  // Check if current user is the author
  const currentUid = currentUser?.id || currentUser?.uid || auth.currentUser?.uid;
  const postAuthorId = post.authorId || post.author?.id;
  const isOwnPost = Boolean(
    currentUid &&
    postAuthorId &&
    currentUid === postAuthorId
  );

  // Double-tap heart burst effect
  const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean caption without hashtags for home feed display
  const cleanCaption = post.caption ? post.caption.replace(/#[\w-]+/g, '').replace(/\s+/g, ' ').trim() : '';

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  // Sync props when post changes
  useEffect(() => {
    setIsLiked(post.isLikedByMe || false);
    setIsBookmarked(post.isBookmarkedByMe || false);
    setLikesCount(post.likesCount || 0);
    setRepostsCount(post.repostsCount || 0);
    setCommentsCount(post.commentsCount || 0);
  }, [post.isLikedByMe, post.isBookmarkedByMe, post.likesCount, post.repostsCount, post.commentsCount]);

  // Check follow status if logged in
  useEffect(() => {
    if (!currentUser || !author?.id || currentUser.id === author.id) return;
    let isMounted = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/follow/${author.id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsFollowing(data.isFollowing);
        }
      } catch (e) {
        console.warn('Could not check follow status:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [currentUser, author?.id]);

  // Handle active video playback & watch time signals
  useEffect(() => {
    if (post.type !== 'video' || !videoRef.current) return;
    const video = videoRef.current;

    if (isActive) {
      setHasError(false);
      watchStartRef.current = Date.now();
      telemetry.track({
        type: 'impression',
        postId: post.id,
        creatorId: author?.id
      });

      video.muted = isGlobalMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          telemetry.track({
            type: 'view',
            postId: post.id,
            creatorId: author?.id
          });
          incrementViewCountOnServer();
        }).catch((err) => {
          // Unmuted autoplay blocked by browser policy, fallback to muted playback
          video.muted = true;
          setIsGlobalMuted(true);
          video.play().then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          }).catch((e) => {
            console.warn('Video playback error on active post:', e);
            setIsPlaying(false);
          });
        });
      }
    } else {
      if (watchStartRef.current > 0) {
        const watched = Date.now() - watchStartRef.current;
        totalWatchTimeRef.current += watched;
        if (watched < 2000) {
          telemetry.track({
            type: 'skip',
            postId: post.id,
            creatorId: author?.id,
            watchTimeMs: watched
          });
        } else {
          telemetry.track({
            type: 'watch_time',
            postId: post.id,
            creatorId: author?.id,
            watchTimeMs: watched
          });
        }
        watchStartRef.current = 0;
      }
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      if (is2xActive) {
        video.playbackRate = 1.0;
        setIs2xActive(false);
      }
    }
  }, [isActive, post.id, author?.id]);

  // Track views on image or text posts when they are active
  useEffect(() => {
    if (isActive && post.type !== 'video') {
      incrementViewCountOnServer();
    }
  }, [isActive, post.id, post.type]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    if (duration > 0) {
      setProgress((currentTime / duration) * 100);
    }
  };

  const handleEnded = () => {
    telemetry.track({
      type: 'completion',
      postId: post.id,
      creatorId: author?.id
    });
  };

  const handleRetryVideo = () => {
    setHasError(false);
    setIsBuffering(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch((err) => {
          console.warn('Retry video play warning:', err);
          setIsBuffering(false);
        });
      } else {
        setIsBuffering(false);
      }
    }, 100);
  };

  const handleLike = () => {
    requireAuth('Like Video', 'Sign in to like this video.', async () => {
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      setLikesCount(prev => Math.max(0, nextLiked ? prev + 1 : prev - 1));

      if (nextLiked) {
        telemetry.track({ type: 'like', postId: post.id, creatorId: author.id });
      }

      dispatchEvent({
        objectId: post.id,
        operation: nextLiked ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'POST', targetId: post.id, isLiked: nextLiked }
      });

      if (!navigator.onLine && nextLiked) {
        recordOfflineAction({ type: 'LIKE', targetId: post.id });
      }
    });
  };

  // Dedicated double-tap like: ONLY likes and records once unless detached (unliked via heart button)
  const handleDoubleTapLike = (x: number, y: number) => {
    // 1. Always display heart burst animation at tap coordinates
    const burstId = Date.now();
    setHeartBursts(prev => [...prev, { id: burstId, x, y }]);
    setTimeout(() => {
      setHeartBursts(prev => prev.filter(b => b.id !== burstId));
    }, 900);

    // 2. Only like if not already liked ("only likes but it's once recorded unless is detached")
    if (!isLiked) {
      requireAuth('Like Video', 'Sign in to like this video.', async () => {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        telemetry.track({ type: 'like', postId: post.id, creatorId: author.id });

        dispatchEvent({
          objectId: post.id,
          operation: 'LIKE',
          payload: { targetType: 'POST', targetId: post.id, isLiked: true }
        });

        if (!navigator.onLine) {
          recordOfflineAction({ type: 'LIKE', targetId: post.id });
        }
      });
    }
  };

  const handleBookmark = () => {
    requireAuth('Bookmark Video', 'Sign in to save this video.', async () => {
      const nextBookmarked = !isBookmarked;
      setIsBookmarked(nextBookmarked);

      if (nextBookmarked) {
        telemetry.track({ type: 'save', postId: post.id, creatorId: author.id });
      }

      dispatchEvent({
        objectId: post.id,
        operation: nextBookmarked ? 'CREATE' : 'DELETE',
        payload: { postId: post.id, isBookmarked: nextBookmarked }
      });
    });
  };

  const handleRepost = () => {
    if (isOwnPost) {
      setActionFeedbackToast("You cannot repost your own post.");
      setTimeout(() => setActionFeedbackToast(null), 2500);
      return;
    }
    requireAuth('Repost Video', 'Sign in to repost this video.', async () => {
      const nextReposted = !isReposted;
      setIsReposted(nextReposted);
      setRepostsCount(prev => Math.max(0, nextReposted ? prev + 1 : prev - 1));

      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          const res = await fetch(`/api/posts/${post.id}/repost`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          if (!res.ok) {
            // Rollback optimistic state
            setIsReposted(!nextReposted);
            setRepostsCount(prev => (!nextReposted ? prev + 1 : Math.max(0, prev - 1)));
            setActionFeedbackToast("Failed to update repost");
            setTimeout(() => setActionFeedbackToast(null), 2500);
            return;
          }
        }
      } catch (err) {
        console.error('Repost error:', err);
        // Rollback optimistic state
        setIsReposted(!nextReposted);
        setRepostsCount(prev => (!nextReposted ? prev + 1 : Math.max(0, prev - 1)));
        setActionFeedbackToast("Network error updating repost");
        setTimeout(() => setActionFeedbackToast(null), 2500);
        return;
      }

      if (nextReposted) {
        telemetry.track({ type: 'share', postId: post.id, creatorId: author.id });
        setActionFeedbackToast("Reposted!");
        setTimeout(() => setActionFeedbackToast(null), 2000);
      }

      dispatchEvent({
        objectId: post.id,
        operation: 'REPOST',
        payload: { postId: post.id }
      });
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      // Right edge swipe left gesture to open creator profile
      if (deltaX < -70 && Math.abs(deltaY) < 60 && touchStartXRef.current > window.innerWidth * 0.45) {
        const targetId = author.id || author.username;
        if (targetId) {
          telemetry.track({ type: 'profile_visit', creatorId: targetId });
          navigate(`/profile/${targetId}`);
        }
      }
    }
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth('Follow Creator', 'Sign in to follow creators.', async () => {
      setIsFollowing(true);
      telemetry.track({ type: 'follow', creatorId: author.id });
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/follow/${author.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          setIsFollowing(false);
          setActionFeedbackToast("Failed to follow creator");
          setTimeout(() => setActionFeedbackToast(null), 2500);
        }
      } catch (err) {
        console.error('Follow error:', err);
        setIsFollowing(false);
        setActionFeedbackToast("Network error while following");
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    });
  };

  const handleShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    telemetry.track({
      type: 'share',
      postId: post.id,
      creatorId: author.id
    });

    const shareUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Omni - @${author.username || 'creator'}`,
        text: post.caption || 'Check out this video on Omni!',
        url: shareUrl
      }).catch(() => {
        // Fallback to clipboard if share was cancelled or unavailable in iframe
        navigator.clipboard.writeText(shareUrl).then(() => {
          setCopiedToast(true);
          setTimeout(() => setCopiedToast(false), 2000);
        }).catch((clipErr) => console.warn('Clipboard write error:', clipErr));
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }).catch((clipErr) => console.warn('Clipboard write error:', clipErr));
    }
    setIsQuickActionsOpen(false);
  };

  const handlePinPost = async () => {
    setIsQuickActionsOpen(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const newPinned = !post.isPinned;
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isPinned: newPinned })
      });
      if (res.ok) {
        post.isPinned = newPinned;
        setActionFeedbackToast(newPinned ? '📌 Post pinned to profile!' : 'Post unpinned');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      } else {
        setActionFeedbackToast('Failed to update pin status');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (err) {
      console.error('Pin post error:', err);
      setActionFeedbackToast('Error updating pin');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  const handleDeletePost = async () => {
    setIsQuickActionsOpen(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setActionFeedbackToast('Post deleted permanently');
        setTimeout(() => {
          onHidePost?.(post.id);
        }, 600);
      } else {
        setActionFeedbackToast('Failed to delete post');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (err) {
      console.error('Delete post error:', err);
      setActionFeedbackToast('Error deleting post');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  const handleDeleteAndEdit = async () => {
    setIsQuickActionsOpen(false);
    const mediaContent = post.content;
    const oldCaption = post.caption;
    const oldTags = post.tags;
    const oldType = post.type;

    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Delete and edit error:', e);
    }

    navigate('/create', {
      state: {
        draftMediaUrl: mediaContent,
        draftCaption: oldCaption,
        draftTags: oldTags,
        draftType: oldType,
      }
    });
  };

  const handleSaveCaption = async (newCaption: string) => {
    setIsEditCaptionOpen(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ caption: newCaption })
      });
      if (res.ok) {
        post.caption = newCaption;
        setActionFeedbackToast('Caption updated!');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      } else {
        setActionFeedbackToast('Failed to update caption');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (err) {
      console.error('Update caption error:', err);
      setActionFeedbackToast('Error updating caption');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  const handleSaveThumbnail = async (newThumbnailUrl: string) => {
    setIsEditThumbnailOpen(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ thumbnailUrl: newThumbnailUrl })
      });
      if (res.ok) {
        post.thumbnailUrl = newThumbnailUrl;
        setActionFeedbackToast('Video cover frame updated!');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      } else {
        setActionFeedbackToast('Failed to update cover frame');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (err) {
      console.error('Update thumbnail error:', err);
      setActionFeedbackToast('Error updating cover frame');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  const handleDownloadVideo = () => {
    setIsQuickActionsOpen(false);
    startBackgroundDownloadVideo(post);
  };

  const handleToggleVisibility = async () => {
    setIsQuickActionsOpen(false);
    const nextVisibility = post.visibility === 'private' ? 'public' : 'private';
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ visibility: nextVisibility })
      });
      if (res.ok) {
        post.visibility = nextVisibility;
        setActionFeedbackToast(nextVisibility === 'private' ? 'Post is now hidden from public (locked tab only)' : 'Post is now public');
        setTimeout(() => setActionFeedbackToast(null), 3000);
      } else {
        setActionFeedbackToast('Failed to update post visibility');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (e) {
      setActionFeedbackToast('Error updating post visibility');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  const handleMakeStatus = async () => {
    setIsQuickActionsOpen(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/posts/${post.id}/make-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setActionFeedbackToast('Added to your 24h Status Stories!');
        setTimeout(() => setActionFeedbackToast(null), 3000);
      } else {
        setActionFeedbackToast('Failed to add status video');
        setTimeout(() => setActionFeedbackToast(null), 2500);
      }
    } catch (e) {
      setActionFeedbackToast('Error adding status video');
      setTimeout(() => setActionFeedbackToast(null), 2500);
    }
  };

  // Handle pointer down for 2X Speed (Left/Right) or Long Press Quick Actions (Middle)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;

    // Left 33% or Right 33% -> Hold for 2X Speed
    if (xRatio < 0.33 || xRatio > 0.67) {
      speedHoldTimeoutRef.current = setTimeout(() => {
        if (post.type === 'video' && videoRef.current) {
          videoRef.current.playbackRate = 2.0;
          setIs2xActive(true);
        }
      }, 150);
    } else {
      // Middle 34% -> Hold > 450ms opens Quick Actions Sheet (Report, Not Interested, etc.)
      isHoldingMiddleRef.current = false;
      middlePressTimeoutRef.current = setTimeout(() => {
        isHoldingMiddleRef.current = true;
        setIsQuickActionsOpen(true);
      }, 450);
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    // Clear speed hold timer & reset video speed
    if (speedHoldTimeoutRef.current) {
      clearTimeout(speedHoldTimeoutRef.current);
      speedHoldTimeoutRef.current = null;
    }
    if (middlePressTimeoutRef.current) {
      clearTimeout(middlePressTimeoutRef.current);
      middlePressTimeoutRef.current = null;
    }

    if (is2xActive && videoRef.current) {
      videoRef.current.playbackRate = 1.0;
      setIs2xActive(false);
    }
  };

  const handleContainerTap = (e: React.MouseEvent<HTMLDivElement>) => {
    // If middle long press was triggered, prevent tap action
    if (isHoldingMiddleRef.current) {
      isHoldingMiddleRef.current = false;
      return;
    }

    const now = Date.now();
    const delta = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (delta < 300) {
      // Double tap confirmed: cancel pending single-tap pause immediately.
      // Real intent is liking, so pause must NEVER interface or trigger on double-tap!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      handleDoubleTapLike(x, y);
    } else {
      // Single tap: queue video play/pause toggle after 260ms window
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        if (post.type === 'video' && videoRef.current) {
          const video = videoRef.current;
          if (video.paused) {
            video.play().then(() => {
              setIsPlaying(true);
              setShowPlayIcon(false);
            }).catch(() => {});
          } else {
            video.pause();
            setIsPlaying(false);
            setShowPlayIcon(true);
            setTimeout(() => setShowPlayIcon(false), 1200);
          }
        }
      }, 260);
    }
  };

  // Algorithmic Feedback: Not Interested
  const handleNotInterested = () => {
    telemetry.track({
      type: 'skip',
      postId: post.id,
      creatorId: author.id,
      watchTimeMs: 0
    });
    setActionFeedbackToast("We'll show fewer posts like this.");
    setIsQuickActionsOpen(false);
    setTimeout(() => {
      onHidePost?.(post.id);
    }, 800);
  };

  // Algorithmic Feedback: Report Content
  const handleReportPost = () => {
    telemetry.track({
      type: 'skip',
      postId: post.id,
      creatorId: author.id,
      watchTimeMs: 0
    });
    setActionFeedbackToast("Thank you. Post reported and removed from your feed.");
    setIsQuickActionsOpen(false);
    setTimeout(() => {
      onHidePost?.(post.id);
    }, 1000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <article
      id={`post-${post.id}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "relative w-full bg-[#07080c] flex flex-col justify-between overflow-hidden select-none",
        compact ? "h-[65vh] rounded-xl mb-4" : "h-full snap-start"
      )}
    >
      {/* Background Media Container with Intelligent 3-Zone Gesture Dispatcher */}
      <div
        className="absolute inset-0 z-0 bg-[#07080c] flex items-center justify-center cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onPointerLeave={handlePointerUpOrCancel}
        onClick={handleContainerTap}
      >
        {(() => {
          const rawSource = post.mediaUrl || post.content;
          const mediaSource = (rawSource && (rawSource.startsWith('http') || rawSource.startsWith('/') || rawSource.startsWith('blob:') || rawSource.startsWith('data:')))
            ? rawSource
            : `/api/posts/${post.id}/media`;

          if (post.type === 'video') {
            return hasError ? (
              <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <AlertCircle size={36} className="text-rose-400 mb-2" />
                <p className="text-xs text-white font-semibold mb-1">Video temporarily unavailable</p>
                <p className="text-[11px] text-slate-500 max-w-xs mb-3">
                  Check your network connection or tap retry to reload stream.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetryVideo();
                  }}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/[0.15] text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={mediaSource}
                className="w-full h-full object-cover"
                loop
                muted={isGlobalMuted}
                playsInline
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setHasError(false);
                }}
                onError={() => {
                  const mediaErr = videoRef.current?.error;
                  // Ignore aborted error (code 1 MEDIA_ERR_ABORTED) when paused, scrolled, or switching sources
                  if (mediaErr && mediaErr.code === 1) return;
                  console.warn('PostCard video element onError fired:', mediaErr?.code, mediaErr?.message);
                  setHasError(true);
                }}
              />
            );
          } else {
            return (
              <img
                src={mediaSource}
                alt={post.caption || 'Post image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            );
          }
        })()}

        {/* Ambient Darkened Vignette for readable overlays */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/55 via-transparent via-55% to-black/95" />
      </div>

      {/* 2X Speed Active Gesture HUD Banner */}
      {is2xActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/75 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.4)] text-cyan-300 font-black text-xs tracking-wider uppercase">
            <Zap size={14} className="fill-cyan-400 animate-pulse text-cyan-400" />
            <span>2X Speed Playback</span>
          </div>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin drop-shadow-[0_0_12px_#00f0ff]" />
        </div>
      )}

      {/* Floating Double Tap Heart Bursts */}
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {heartBursts.map(burst => (
            <motion.div
              key={burst.id}
              initial={{ scale: 0, opacity: 0.9, y: 0 }}
              animate={{ scale: [0, 1.35, 1], opacity: [0.9, 1, 0], y: -40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ left: burst.x - 40, top: burst.y - 40 }}
              className="absolute pointer-events-none text-cyan-400 drop-shadow-[0_0_20px_rgba(0,240,255,0.7)]"
            >
              <Heart size={80} fill="currentColor" strokeWidth={1.5} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Play/Pause Pulse Icon */}
      {showPlayIcon && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            className="w-20 h-20 rounded-full bg-black/60 flex items-center justify-center text-white"
          >
            <Play size={36} fill="currentColor" className="ml-1 text-cyan-400" />
          </motion.div>
        </div>
      )}

      {/* Top Bar Overlay: Toast Alerts */}
      <div className="relative z-20 pt-safe px-4 py-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          {copiedToast && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500 text-[#07080c] text-xs font-bold shadow-lg animate-in fade-in">
              <Check size={14} strokeWidth={3} /> Link copied!
            </div>
          )}
          {actionFeedbackToast && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/95 text-cyan-300 text-xs font-semibold shadow-2xl animate-in fade-in">
              <Check size={14} className="text-cyan-400" /> {actionFeedbackToast}
            </div>
          )}
        </div>
      </div>

      {/* Main Bottom Section: Details + Right Rail Actions */}
      <div className="relative z-20 flex items-end justify-between px-4 pb-20 pt-4 pointer-events-none">
        {/* Left: Author Username, Clean Caption (No Hashtags), Audio Track */}
        <div className="flex-1 pr-3 pointer-events-auto max-w-[80%] flex flex-col justify-end space-y-1.5">
          {/* Repost Indicator Banner */}
          {post.repostedBy && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                const reposterId = post.repostedBy?.id || post.repostedBy?.uid || post.repostedBy?.username;
                if (reposterId) navigate(`/profile/${reposterId}`);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-cyan-400/40 text-[11px] font-bold text-cyan-300 shadow-sm mb-0.5 w-fit cursor-pointer hover:bg-black/90 transition-colors pointer-events-auto"
            >
              <Repeat2 size={12} className="text-cyan-400 shrink-0" />
              <span className="truncate max-w-[180px]">
                {post.repostedBy.displayName || post.repostedBy.username} reposted
              </span>
            </div>
          )}

          {/* Author Thumbnail + Username and Timestamp */}
          <div
            onClick={() => {
              telemetry.track({ type: 'profile_visit', creatorId: author.id });
              navigate(`/profile/${author.id || author.username}`);
            }}
            className="inline-flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shadow transition-all shrink-0 ring-2 ring-cyan-400 ring-offset-1 ring-offset-black">
              <img
                src={author.avatar}
                alt={author.displayName || author.username || 'Creator'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span className="font-bold text-white text-sm sm:text-base tracking-tight drop-shadow-md group-hover:text-cyan-300 transition-colors">
              {author.displayName || author.username || 'creator'}
            </span>
            <span className="text-xs text-slate-300/90 drop-shadow">
              • {formatPostTime(post.createdAt)}
            </span>
          </div>

          {/* Caption with Clickable Hashtags */}
          {post.caption && (
            <div className="text-xs sm:text-sm text-slate-100 font-normal leading-relaxed drop-shadow">
              <p className={cn("whitespace-pre-wrap transition-all", !captionExpanded && "line-clamp-2")}>
                <HashtagParser text={post.caption} />
              </p>
              {post.caption.length > 90 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCaptionExpanded(!captionExpanded);
                  }}
                  className="text-xs text-cyan-300 font-semibold mt-0.5 hover:underline"
                >
                  {captionExpanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}

          {/* Audio Track Metadata Pill */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/search?q=${encodeURIComponent(author.username || author.displayName || 'music')}`);
            }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs text-slate-200 w-fit drop-shadow hover:bg-black/60 active:scale-95 transition-all text-left"
            title="Explore audio"
          >
            <Music2 size={13} className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="font-medium tracking-wide truncate max-w-[180px]">
              Original Audio — {author.displayName || author.username || 'creator'}
            </span>
          </button>
        </div>

        {/* Right: Vertical Interaction Rail */}
        <div className="flex flex-col items-center gap-2.5 pb-2 pointer-events-auto shrink-0">
          {/* Creator Follow Badge if not following */}
          {(!currentUser || currentUser.id !== author.id) && !isFollowing && (
            <button
              onClick={handleFollow}
              aria-label="Follow creator"
              className="w-7 h-7 -mb-0.5 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
            >
              <Plus size={15} strokeWidth={3} />
            </button>
          )}

          {/* Like Button */}
          <button
            onClick={handleLike}
            aria-label={isLiked ? "Unlike post" : "Like post"}
            className="flex flex-col items-center group focus:outline-none"
          >
            <div
              className={cn(
                "p-1.5 rounded-full transition-all active:scale-75",
                isLiked
                  ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]"
                  : "text-white hover:text-cyan-300 drop-shadow"
              )}
            >
              <Heart
                size={26}
                strokeWidth={isLiked ? 2.5 : 2}
                className={cn(isLiked && "fill-cyan-400")}
              />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              {formatNumber(likesCount)}
            </span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => {
              requireAuth('Comments', 'Sign in to view and write comments.', () => {
                setIsCommentModalOpen(true);
              });
            }}
            aria-label="View comments"
            className="flex flex-col items-center group focus:outline-none"
          >
            <div className="p-1.5 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90">
              <MessageCircle size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              {formatNumber(commentsCount)}
            </span>
          </button>

          {/* Bookmark / Save Button */}
          <button
            onClick={handleBookmark}
            aria-label={isBookmarked ? "Remove from bookmarks" : "Save post"}
            className="flex flex-col items-center group focus:outline-none"
          >
            <div
              className={cn(
                "p-1.5 rounded-full transition-all active:scale-90",
                isBookmarked
                  ? "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                  : "text-white hover:text-amber-300 drop-shadow"
              )}
            >
              <Bookmark
                size={26}
                strokeWidth={isBookmarked ? 2.5 : 2}
                className={cn(isBookmarked && "fill-amber-400")}
              />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              Save
            </span>
          </button>

          {/* Repost Button */}
          <button
            onClick={handleRepost}
            aria-label="Repost"
            className="flex flex-col items-center group focus:outline-none"
          >
            <div
              className={cn(
                "p-1.5 rounded-full transition-all active:scale-90",
                isReposted
                  ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                  : "text-white hover:text-emerald-300 drop-shadow"
              )}
            >
              <Repeat2 size={26} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              {formatNumber(repostsCount)}
            </span>
          </button>

          {/* Modern Sleek Share Button */}
          <button
            onClick={handleShare}
            aria-label="Share post"
            className="flex flex-col items-center group focus:outline-none"
          >
            <div className="p-1.5 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90">
              <Send size={24} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              Share
            </span>
          </button>

          {/* Mute / Unmute Button (Placed directly below Share Button) */}
          {post.type === 'video' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsGlobalMuted(!isGlobalMuted);
              }}
              aria-label={isGlobalMuted ? 'Unmute video' : 'Mute video'}
              className="flex flex-col items-center group focus:outline-none mt-1"
            >
              <div className="p-1.5 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90">
                {isGlobalMuted ? (
                  <VolumeX size={24} strokeWidth={2} className="text-slate-300" />
                ) : (
                  <Volume2 size={24} strokeWidth={2} className="text-cyan-400" />
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-300 drop-shadow -mt-1">
                {isGlobalMuted ? 'Muted' : 'Sound'}
              </span>
            </button>
          )}

          {/* Three-Dots Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsQuickActionsOpen(true);
            }}
            aria-label="Post options"
            className="flex flex-col items-center group focus:outline-none mt-1"
          >
            <div className="p-1.5 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90 bg-black/40 backdrop-blur-md">
              <MoreVertical size={20} strokeWidth={2.5} className="text-cyan-400" />
            </div>
            <span className="text-[10px] font-medium text-slate-300 drop-shadow -mt-0.5">
              More
            </span>
          </button>
        </div>
      </div>

      {/* Video Playback Progress Bar */}
      {post.type === 'video' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
          <div
            className="h-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Long Press & Three-Dots Quick Actions Sheet */}
      {isQuickActionsOpen && (
        <div
          onClick={() => setIsQuickActionsOpen(false)}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0f1118] border border-white/[0.08] p-4 shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-4 duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-white/20 self-center mb-1" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Post Options
            </h3>

            {/* Download Video (iOS Downloading HUD) */}
            <button
              onClick={handleDownloadVideo}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-left text-sm font-semibold text-cyan-300 transition-colors border border-cyan-400/20"
            >
              <Download size={18} className="text-cyan-400" />
              Download Video
            </button>

            {/* Owner Post Controls */}
            {isOwnPost && (
              <>
                <button
                  onClick={handlePinPost}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
                >
                  <Pin size={18} className="text-amber-400" />
                  {post.isPinned ? 'Unpin Post' : 'Pin Post to Profile'}
                </button>

                <button
                  onClick={handleToggleVisibility}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
                >
                  <EyeOff size={18} className="text-purple-400" />
                  {post.visibility === 'private' ? 'Make Post Public' : 'Hide Post from Public'}
                </button>

                {post.type === 'video' && (
                  <button
                    onClick={handleMakeStatus}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-cyan-300 transition-colors"
                  >
                    <Plus size={18} className="text-cyan-400" />
                    Turn into Status Video (24h)
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsEditCaptionOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
                >
                  <Edit3 size={18} className="text-cyan-400" />
                  Edit Caption
                </button>

                {post.type === 'video' && (
                  <button
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      setIsEditThumbnailOpen(true);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
                  >
                    <ImageIcon size={18} className="text-cyan-400" />
                    Edit Video Cover Frame
                  </button>
                )}

                <button
                  onClick={handleDeleteAndEdit}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-amber-300 transition-colors"
                >
                  <Scissors size={18} className="text-amber-400" />
                  Delete & Edit Post
                </button>

                <button
                  onClick={handleDeletePost}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-500/10 text-left text-sm font-semibold text-rose-400 transition-colors"
                >
                  <Trash2 size={18} />
                  Delete Permanently
                </button>
              </>
            )}

            {/* General Viewer Actions */}
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
            >
              <Copy size={18} className="text-slate-300" />
              Copy Link & Share
            </button>

            <button
              onClick={() => {
                handleBookmark();
                setIsQuickActionsOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-slate-200 transition-colors"
            >
              <Bookmark size={18} className="text-amber-400" />
              {isBookmarked ? 'Remove from Saved' : 'Save to Favorites'}
            </button>

            {!isOwnPost && (
              <>
                <button
                  onClick={handleNotInterested}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-slate-200 transition-colors"
                >
                  <EyeOff size={18} className="text-amber-400" />
                  Not Interested
                </button>

                <button
                  onClick={handleReportPost}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-rose-400 transition-colors"
                >
                  <Flag size={18} />
                  Report Content
                </button>
              </>
            )}

            <button
              onClick={() => setIsQuickActionsOpen(false)}
              className="mt-2 w-full py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Caption Modal */}
      {isEditCaptionOpen && (
        <EditCaptionModal
          post={post}
          onClose={() => setIsEditCaptionOpen(false)}
          onSaveCaption={handleSaveCaption}
        />
      )}

      {/* Edit Thumbnail Modal */}
      {isEditThumbnailOpen && (
        <ThumbnailPickerModal
          post={post}
          onClose={() => setIsEditThumbnailOpen(false)}
          onSaveThumbnail={handleSaveThumbnail}
        />
      )}

      {/* Comments Sheet */}
      {isCommentModalOpen && (
        <CommentModal
          postId={post.id}
          onClose={() => setIsCommentModalOpen(false)}
        />
      )}
    </article>
  );
}
