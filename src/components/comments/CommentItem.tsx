import React, { useState } from 'react';
import { Heart, MessageCircle, Trash2, Flag, Check } from 'lucide-react';
import { Comment } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface CommentItemProps {
  comment: Comment;
  onReply?: (username: string) => void;
  onDelete?: (commentId: string) => void;
}

export function CommentItem({ comment, onReply, onDelete }: CommentItemProps) {
  const { requireAuth, dispatchEvent, currentUser } = useAppContext();
  const author = comment.author;
  const navigate = useNavigate();
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [reported, setReported] = useState(false);

  if (!author) return null;

  const isMyComment = currentUser && currentUser.id === author.id;

  const handleLike = () => {
    requireAuth('Like Comment', 'Sign in to like comments.', () => {
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      setLikesCount(prev => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
      
      dispatchEvent({
        objectId: comment.id,
        operation: nextLiked ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'COMMENT' }
      });
    });
  };

  const handleReport = () => {
    setReported(true);
    setTimeout(() => setReported(false), 2000);
  };

  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
      <div 
        onClick={() => navigate(`/profile/${author.id}`)}
        className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0  cursor-pointer"
      >
        <img src={author.avatar} alt={author.displayName} className="w-full h-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span 
            onClick={() => navigate(`/profile/${author.id}`)}
            className="font-bold text-xs text-white tracking-tight cursor-pointer hover:underline"
          >
            {author.displayName}
          </span>
          <span className="text-[10px] text-slate-500">
            @{author.username} • {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false }) : 'now'}
          </span>
        </div>
        
        {/* Render text with styled @mentions */}
        <p className="text-xs text-slate-200 leading-relaxed break-words">
          {comment.text.split(' ').map((word, i) => {
            if (word.startsWith('@')) {
              return (
                <span key={i} className="text-cyan-400 font-semibold cursor-pointer hover:underline mr-1">
                  {word}{' '}
                </span>
              );
            }
            return word + ' ';
          })}
        </p>

        {/* Comment actions row */}
        <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-500 font-semibold">
          {onReply && (
            <button
              onClick={() => onReply(author.username)}
              className="hover:text-cyan-300 transition-colors"
            >
              Reply
            </button>
          )}

          {isMyComment && onDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Trash2 size={11} /> Delete
            </button>
          )}

          {!isMyComment && (
            <button
              onClick={handleReport}
              className="text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
            >
              {reported ? <span className="text-cyan-400">Reported</span> : <Flag size={10} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
        <button 
          onClick={handleLike}
          aria-label={isLiked ? "Unlike comment" : "Like comment"}
          className={cn(
            "p-1.5 rounded-full transition-all active:scale-75",
            isLiked ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" : "text-slate-500 hover:text-cyan-300"
          )}
        >
          <Heart size={14} className={cn(isLiked && "fill-cyan-400")} />
        </button>
        {likesCount > 0 && (
          <span className={cn("text-[10px] font-semibold", isLiked ? "text-cyan-400" : "text-slate-500")}>
            {likesCount}
          </span>
        )}
      </div>
    </div>
  );
}
