import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Volume2,
  VolumeX,
  Plus,
  Play,
  Bookmark,
  Music2,
  Check,
  MoreVertical,
  Flag,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Post } from '../types';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { CommentModal } from './comments/CommentModal';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { telemetry } from '../lib/telemetry';

interface PostCardProps {
  post: Post;
  isActive?: boolean;
  compact?: boolean;
}

export function PostCard({ post, isActive = true, compact = false }: PostCardProps) {
  const {
    requireAuth,
    currentUser,
    dispatchEvent,
    isGlobalMuted,
    setIsGlobalMuted
  } = useAppContext();
  const author = post.author;
  const navigate = useNavigate();

  // Optimistic states
  const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarkedByMe || false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Video playback & metrics
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // Telemetry watch-time tracking
  const watchStartRef = useRef<number>(0);
  const totalWatchTimeRef = useRef<number>(0);

  // Debounce lock against rapid taps
  const isLikingRef = useRef(false);
  const isSavingRef = useRef(false);
  const isFollowingRef = useRef(false);

  // Double-tap heart burst effect
  const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTapTimeRef = useRef<number>(0);

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
      } catch (e) {}
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

      video.play().then(() => {
        setIsPlaying(true);
        telemetry.track({
          type: 'view',
          postId: post.id,
          creatorId: author?.id
        });
      }).catch(() => {
        setIsPlaying(false);
      });
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
    }
  }, [isActive, post.id, post.type, author?.id]);

  if (!author) return null;

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
      creatorId: author.id,
      videoDurationSec: videoRef.current?.duration
    });
  };

  const handleRetryVideo = () => {
    setHasError(false);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => setHasError(true));
    }
  };

  const handleLike = () => {
    if (isLikingRef.current) return;
    requireAuth('Like Post', 'Sign in to like this post.', () => {
      isLikingRef.current = true;
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      setLikesCount(prev => (nextLiked ? prev + 1 : Math.max(prev - 1, 0)));

      telemetry.track({
        type: nextLiked ? 'like' : 'unlike',
        postId: post.id,
        creatorId: author.id
      });

      dispatchEvent({
        objectId: post.id,
        operation: nextLiked ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'POST' }
      });

      setTimeout(() => {
        isLikingRef.current = false;
      }, 400);
    });
  };

  const handleBookmark = () => {
    if (isSavingRef.current) return;
    requireAuth('Save Post', 'Sign in to save this post to your library.', async () => {
      isSavingRef.current = true;
      const nextSaved = !isBookmarked;
      setIsBookmarked(nextSaved);

      telemetry.track({
        type: 'save',
        postId: post.id,
        creatorId: author.id
      });

      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`/api/posts/${post.id}/bookmark`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        setIsBookmarked(!nextSaved);
      } finally {
        isSavingRef.current = false;
      }
    });
  };

  const handleRepost = () => {
    requireAuth('Repost', 'Sign in to repost this video to your followers.', () => {
      const nextReposted = !isReposted;
      setIsReposted(nextReposted);
      setRepostsCount(prev => (nextReposted ? prev + 1 : Math.max(prev - 1, 0)));

      if (nextReposted) {
        dispatchEvent({
          objectId: post.id,
          operation: 'REPOST',
          payload: { targetType: 'POST' }
        });
      }
    });
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowingRef.current) return;
    requireAuth('Follow', 'Sign in to follow creators.', async () => {
      isFollowingRef.current = true;
      const nextFollowing = !isFollowing;
      setIsFollowing(nextFollowing);

      telemetry.track({
        type: 'follow',
        creatorId: author.id
      });

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/follow/${author.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setIsFollowing(data.followed);
      } catch (e) {
        setIsFollowing(!nextFollowing);
      } finally {
        isFollowingRef.current = false;
      }
    });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    telemetry.track({
      type: 'share',
      postId: post.id,
      creatorId: author.id
    });

    const shareUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Omni - @${author.username}`,
        text: post.caption || 'Check out this video on Omni!',
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      });
    }
  };

  const handleContainerTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const delta = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (delta < 320) {
      // Double tap -> trigger heart burst and like
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const burstId = now;
      setHeartBursts(prev => [...prev, { id: burstId, x, y }]);
      setTimeout(() => {
        setHeartBursts(prev => prev.filter(b => b.id !== burstId));
      }, 900);

      if (!isLiked) {
        handleLike();
      }
    } else {
      // Single tap -> toggle video playback
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
    }
  };

  const handleReportPost = () => {
    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setIsMoreMenuOpen(false);
    }, 1800);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        "relative w-full bg-[#07080c] flex flex-col justify-between overflow-hidden select-none",
        compact ? "h-[65vh] rounded-xl mb-4" : "h-full snap-start"
      )}
    >
      {/* Background Media Container */}
      <div
        className="absolute inset-0 z-0 bg-[#07080c] flex items-center justify-center cursor-pointer"
        onClick={handleContainerTap}
      >
        {post.type === 'video' ? (
          hasError ? (
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
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/[0.15]  text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={post.content}
              className="w-full h-full object-cover"
              loop
              muted={isGlobalMuted}
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onError={() => setHasError(true)}
            />
          )
        ) : (
          post.content && (
            <img
              src={post.content}
              alt={post.caption || 'Post image'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )
        )}

        {/* Ambient Darkened Vignette for readable overlays */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/55 via-transparent via-55% to-black/95" />
      </div>

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
            className="w-20 h-20 rounded-full bg-black/60   flex items-center justify-center text-white"
          >
            <Play size={36} fill="currentColor" className="ml-1 text-cyan-400" />
          </motion.div>
        </div>
      )}

      {/* Top Bar Overlay: Audio Mute Toggle, More Options & Link Toast */}
      <div className="relative z-20 pt-safe px-4 py-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          {copiedToast && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500 text-[#07080c] text-xs font-bold shadow-lg animate-in fade-in">
              <Check size={14} strokeWidth={3} /> Link copied!
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {post.type === 'video' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsGlobalMuted(!isGlobalMuted);
              }}
              aria-label={isGlobalMuted ? 'Unmute video' : 'Mute video'}
              className="p-2.5 rounded-full bg-black/40 hover:bg-black/60   text-white transition-colors active:scale-95 shadow-md"
            >
              {isGlobalMuted ? <VolumeX size={18} className="text-slate-300" /> : <Volume2 size={18} className="text-cyan-400" />}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMoreMenuOpen(true);
            }}
            aria-label="More options"
            className="p-2.5 rounded-full bg-black/40 hover:bg-black/60   text-white transition-colors active:scale-95 shadow-md"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Main Bottom Section: Details + Right Rail Actions */}
      <div className="relative z-20 flex items-end justify-between px-4 pb-20 pt-4 pointer-events-none">
        {/* Left: Author Info, Caption, Audio Track */}
        <div className="flex-1 pr-3 pointer-events-auto max-w-[78%] flex flex-col justify-end space-y-2">
          {/* Author Handle and Timestamp */}
          <div
            onClick={() => {
              telemetry.track({ type: 'profile_visit', creatorId: author.id });
              navigate(`/profile/${author.id}`);
            }}
            className="inline-flex items-center gap-2 cursor-pointer group"
          >
            <span className="font-bold text-white text-base tracking-tight drop-shadow-md group-hover:text-cyan-300 transition-colors">
              @{author.username}
            </span>
            <span className="text-xs text-slate-300 drop-shadow">
              • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Caption with hashtag rendering */}
          {post.caption && (
            <div className="text-sm text-slate-100 font-normal leading-relaxed drop-shadow">
              <p className={cn("whitespace-pre-wrap transition-all", !captionExpanded && "line-clamp-2")}>
                {post.caption.split(' ').map((word, idx) => {
                  if (word.startsWith('#')) {
                    return (
                      <span
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/search?q=${encodeURIComponent(word)}`);
                        }}
                        className="text-cyan-400 font-semibold cursor-pointer hover:underline mr-1"
                      >
                        {word}{' '}
                      </span>
                    );
                  }
                  return word + ' ';
                })}
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10   text-xs text-slate-200 w-fit drop-shadow">
            <Music2 size={13} className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="font-medium tracking-wide truncate max-w-[180px]">
              Original Audio — @{author.username}
            </span>
          </div>
        </div>

        {/* Right: Vertical Interaction Rail */}
        <div className="flex flex-col items-center gap-4 pb-2 pointer-events-auto shrink-0">
          {/* Creator Avatar & Quick Follow Badge */}
          <div
            className="relative cursor-pointer group"
            onClick={() => {
              telemetry.track({ type: 'profile_visit', creatorId: author.id });
              navigate(`/profile/${author.id}`);
            }}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-white/80 shadow-[0_0_12px_rgba(0,0,0,0.6)] group-hover:border-cyan-400 transition-colors">
              <img
                src={author.avatar}
                alt={author.displayName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {(!currentUser || currentUser.id !== author.id) && !isFollowing && (
              <button
                onClick={handleFollow}
                aria-label="Follow creator"
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
              >
                <Plus size={13} strokeWidth={3} />
              </button>
            )}
          </div>

          {/* Like Button */}
          <button
            onClick={handleLike}
            aria-label={isLiked ? "Unlike post" : "Like post"}
            className="flex flex-col items-center group focus:outline-none"
          >
            <div
              className={cn(
                "p-2 rounded-full transition-all active:scale-75",
                isLiked
                  ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]"
                  : "text-white hover:text-cyan-300 drop-shadow"
              )}
            >
              <Heart
                size={28}
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
            <div className="p-2 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90">
              <MessageCircle size={28} strokeWidth={2} />
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
                "p-2 rounded-full transition-all active:scale-90",
                isBookmarked
                  ? "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                  : "text-white hover:text-amber-300 drop-shadow"
              )}
            >
              <Bookmark
                size={28}
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
                "p-2 rounded-full transition-all active:scale-90",
                isReposted
                  ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                  : "text-white hover:text-emerald-300 drop-shadow"
              )}
            >
              <Repeat2 size={28} strokeWidth={isReposted ? 2.5 : 2} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              {formatNumber(repostsCount)}
            </span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            aria-label="Share post"
            className="flex flex-col items-center group focus:outline-none"
          >
            <div className="p-2 rounded-full text-white hover:text-cyan-300 transition-colors drop-shadow active:scale-90">
              <Share2 size={26} strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow -mt-1">
              Share
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

      {/* More Options Sheet */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70  p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#0f1118]  p-4 shadow-2xl flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Post Options
            </h3>

            {reportSuccess ? (
              <div className="p-4 text-center text-xs text-cyan-300 font-bold bg-cyan-500/10 rounded-2xl ">
                Thank you. We have received your report and will review this content.
              </div>
            ) : (
              <>
                <button
                  onClick={handleShare}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.05] text-left text-sm font-semibold text-white transition-colors"
                >
                  <Share2 size={18} className="text-cyan-400" />
                  Copy Video Link
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
              onClick={() => setIsMoreMenuOpen(false)}
              className="mt-2 w-full py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Real Comments Sheet */}
      {isCommentModalOpen && (
        <CommentModal
          postId={post.id}
          onClose={() => setIsCommentModalOpen(false)}
        />
      )}
    </article>
  );
}
