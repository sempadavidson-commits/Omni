import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post } from '../types';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { CommentModal } from './comments/CommentModal';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { requireAuth, currentUser, dispatchEvent } = useAppContext();
  const author = post.author;
  
  // Local optimistic state
  const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  
  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Autoplay video logic based on visibility (simplified for prototype)
  useEffect(() => {
    if (post.type === 'video' && videoRef.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {});
          } else {
            videoRef.current?.pause();
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
      
      // Dispatch signed event to SyncEngine
      dispatchEvent({
        objectId: post.id,
        operation: newState ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'POST' }
      });
    });
  };

  const handleRepost = () => {
    requireAuth('Repost', 'Create an account to like, comment, repost and follow.', () => {
      const newState = !isReposted;
      setIsReposted(newState);
      setRepostsCount(prev => newState ? prev + 1 : prev - 1);
      
      // Dispatch signed event to SyncEngine
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

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <article className="border-b border-zinc-900 pb-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
            <img src={author.avatar} alt={author.username} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-sm tracking-wide">{author.displayName}</span>
              <span className="text-zinc-500 text-sm">@{author.username}</span>
            </div>
            <span className="text-zinc-600 text-xs">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <button className="text-zinc-500 hover:text-white p-2 transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="px-4">
        {post.caption && (
          <p className="text-zinc-200 text-sm mb-3 leading-relaxed whitespace-pre-wrap">
            {post.caption}
          </p>
        )}
      </div>

      {/* Media Attachment */}
      {post.content && (
        <div className="px-4 mb-3">
          <div className="w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 max-h-[500px] relative">
            {post.type === 'video' ? (
              <>
                <video 
                  ref={videoRef}
                  src={post.content} 
                  className="w-full h-full object-cover" 
                  loop 
                  muted={isMuted}
                  playsInline
                />
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-3 right-3 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white transition-colors"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            ) : (
              <img src={post.content} alt="Post content" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={handleLike}
            className={cn(
              "flex items-center gap-2 group transition-colors",
              isLiked ? "text-rose-500" : "text-zinc-500 hover:text-rose-400"
            )}
          >
            <div className="p-2 -ml-2 rounded-full group-hover:bg-rose-500/10 transition-colors">
              <Heart size={20} className={cn(isLiked && "fill-current")} />
            </div>
            <span className="text-xs font-medium">{formatNumber(likesCount)}</span>
          </button>
          
          <button 
            onClick={handleComment}
            className="flex items-center gap-2 text-zinc-500 hover:text-blue-400 group transition-colors"
          >
            <div className="p-2 -ml-2 rounded-full group-hover:bg-blue-400/10 transition-colors">
              <MessageCircle size={20} />
            </div>
            <span className="text-xs font-medium">{formatNumber(post.commentsCount || 0)}</span>
          </button>

          <button 
            onClick={handleRepost}
            className={cn(
              "flex items-center gap-2 group transition-colors",
              isReposted ? "text-emerald-500" : "text-zinc-500 hover:text-emerald-400"
            )}
          >
            <div className="p-2 -ml-2 rounded-full group-hover:bg-emerald-400/10 transition-colors">
              <Repeat2 size={20} />
            </div>
            <span className="text-xs font-medium">{formatNumber(repostsCount)}</span>
          </button>
        </div>

        <button onClick={handleShare} className="flex items-center gap-2 text-zinc-500 hover:text-white group transition-colors">
          <div className="p-2 -mr-2 rounded-full group-hover:bg-zinc-800 transition-colors">
            <Share size={20} />
          </div>
        </button>
      </div>

      {isCommentModalOpen && (
        <CommentModal postId={post.id} onClose={() => setIsCommentModalOpen(false)} />
      )}
    </article>
  );
}
