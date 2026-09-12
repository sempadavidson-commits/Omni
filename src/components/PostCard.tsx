import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Repeat2, Share, Volume2, VolumeX, Plus, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { auth } from '../lib/firebase';
import { Post } from '../types';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { CommentModal } from './comments/CommentModal';
import { useNavigate } from 'react-router-dom';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { requireAuth, currentUser, dispatchEvent, isGlobalMuted, setIsGlobalMuted } = useAppContext();
  const author = post.author;
  const navigate = useNavigate();
  
  // Local optimistic state
  const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  
  useEffect(() => {
    setIsLiked(post.isLikedByMe || false);
    setLikesCount(post.likesCount || 0);
    setRepostsCount(post.repostsCount || 0);
  }, [post.isLikedByMe, post.likesCount, post.repostsCount]);

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Autoplay video logic based on visibility (simplified for prototype)
  useEffect(() => {
    if (post.type === 'video' && videoRef.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {});
            setIsPlaying(true);
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      }, { threshold: 0.6 });
      
      observer.observe(videoRef.current);
      return () => observer.disconnect();
    }
  }, [post.type]);

  if (!author) return null;

  const handleLike = () => {
    requireAuth('Like Post', 'Create an account to like, comment, repost and follow.', () => {
      const newState = !isLiked;
      setIsLiked(newState);
      setLikesCount(prev => newState ? prev + 1 : prev - 1);
      
      dispatchEvent({
        objectId: post.id,
        operation: newState ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'POST' }
      });
    });
  };

  const lastTapRef = useRef<number>(0);
  const handleMediaClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeSinceLastTap < 300) {
      // Double tap detected
      if (!isLiked) handleLike();
    } else {
      // Single tap - toggle play/pause
      // We use a small timeout to ensure it's not a double tap before pausing
      setTimeout(() => {
        if (Date.now() - lastTapRef.current >= 300) {
          if (post.type === 'video' && videoRef.current) {
            const video = videoRef.current;
            if (video.paused) { video.play(); setIsPlaying(true); }
            else { video.pause(); setIsPlaying(false); }
          }
        }
      }, 300);
    }
  };

  const handleRepost = () => {
    requireAuth('Repost', 'Create an account to like, comment, repost and follow.', () => {
      const newState = !isReposted;
      setIsReposted(newState);
      setRepostsCount(prev => newState ? prev + 1 : prev - 1);
      
      if (newState) {
        dispatchEvent({
          objectId: post.id,
          operation: 'REPOST',
          payload: { targetType: 'POST' }
        });
      }
    });
  };

  const handleComment = () => {
    requireAuth('Comment', 'Sign in to join the conversation.', () => {
      setIsCommentModalOpen(true);
    });
  };

  const handleShare = () => {
    const url = window.location.origin + '/post/' + post.id;
    if (navigator.share) {
      navigator.share({
        title: `Post by @${author.username}`,
        text: post.caption || 'Check out this post!',
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth('Follow', 'Sign in to follow this user.', async () => {
      setIsFollowing(!isFollowing);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/follow/${author.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setIsFollowing(data.followed);
      } catch (err) {
        setIsFollowing(!isFollowing); // revert
      }
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <article className="w-full h-[100dvh] snap-start relative bg-black flex flex-col justify-end">
      {/* Full screen media */}
      <div className="absolute inset-0 z-0 bg-zinc-900" onClick={handleMediaClick}>
        {post.type === 'video' ? (
          <video 
            ref={videoRef}
            src={post.content} 
            className="w-full h-full object-cover" 
            loop 
            muted={isGlobalMuted}
            playsInline
          />
        ) : (
          post.content && <img src={post.content} alt="Post content" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>

      {/* Overlay gradient for readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

      {/* Play indicator */}
      {!isPlaying && post.type === 'video' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm p-4 rounded-full text-white/80">
            <Play size={48} fill="currentColor" />
          </div>
        </div>
      )}

      {/* Video controls (mute toggle) */}
      {post.type === 'video' && (
        <button 
          onClick={(e) => { e.stopPropagation(); setIsGlobalMuted(!isGlobalMuted); }}
          className="absolute top-20 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
        >
          {isGlobalMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}

      {/* Main Content Area */}
      <div className="relative z-20 flex w-full pb-20 px-4">
        {/* Left side: Info */}
        <div className="flex-1 pr-4 flex flex-col justify-end pb-2">
          <h3 className="font-bold text-white text-lg tracking-wide mb-2 flex items-center gap-2">
            @{author.username}
            <span className="text-zinc-400 text-xs font-normal">
              • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </h3>
          
          {post.caption && (
            <p className="text-zinc-100 text-sm mb-2 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto hide-scrollbar">
              {post.caption}
            </p>
          )}
        </div>

        {/* Right side: Vertical Actions */}
        <div className="flex flex-col items-center justify-end gap-5 pb-2">
          {/* Profile pic & Follow button */}
          <div className="relative mb-2 cursor-pointer" onClick={() => navigate(`/profile/${author.id}`)}>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-white">
              <img src={author.avatar} alt={author.username} className="w-full h-full object-cover" />
            </div>
            {(!currentUser || currentUser.id !== author.id) && !isFollowing && (
              <button 
                onClick={handleFollow}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center border border-white text-white"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            )}
          </div>

          <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
            <div className={cn("p-1 transition-colors drop-shadow-md", isLiked ? "text-rose-500" : "text-white hover:text-zinc-300")}>
              <Heart size={32} strokeWidth={2} className={cn(isLiked && "fill-current")} />
            </div>
            <span className="text-xs font-bold text-white drop-shadow-md">{formatNumber(likesCount)}</span>
          </button>
          
          <button onClick={handleComment} className="flex flex-col items-center gap-1 group">
            <div className="p-1 text-white hover:text-zinc-300 transition-colors drop-shadow-md">
              <MessageCircle size={32} strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-white drop-shadow-md">{formatNumber(post.commentsCount || 0)}</span>
          </button>

          <button onClick={handleRepost} className="flex flex-col items-center gap-1 group">
            <div className={cn("p-1 transition-colors drop-shadow-md", isReposted ? "text-emerald-500" : "text-white hover:text-zinc-300")}>
              <Repeat2 size={32} strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-white drop-shadow-md">{formatNumber(repostsCount)}</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
            <div className="p-1 text-white hover:text-zinc-300 transition-colors drop-shadow-md">
              <Share size={32} strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-white drop-shadow-md">Share</span>
          </button>
        </div>
      </div>

      {isCommentModalOpen && (
        <CommentModal postId={post.id} onClose={() => setIsCommentModalOpen(false)} />
      )}
    </article>
  );
}
