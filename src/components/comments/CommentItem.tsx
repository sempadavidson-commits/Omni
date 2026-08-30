import React, { useState } from 'react';
import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { Comment } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppContext } from '../../context/AppContext';

interface CommentItemProps {
  comment: Comment;
}

export function CommentItem({ comment }: CommentItemProps) {
  const { requireAuth, dispatchEvent } = useAppContext();
  const author = comment.author;
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);

  if (!author) return null;

  const handleLike = () => {
    requireAuth('Like Comment', 'Create an account to like comments.', () => {
      const newState = !isLiked;
      setIsLiked(newState);
      setLikesCount(prev => newState ? prev + 1 : prev - 1);
      
      dispatchEvent({
        objectId: comment.id,
        operation: newState ? 'LIKE' : 'UNLIKE',
        payload: { targetType: 'COMMENT' }
      });
    });
  };

  const handleReply = () => {
    requireAuth('Reply', 'Sign in to join the conversation.', () => {
      // In a real app, this would focus the input and tag the user
    });
  };

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0">
        <img src={author.avatar} alt={author.displayName} className="w-full h-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm text-white tracking-wide">{author.displayName}</span>
          <span className="text-xs text-zinc-500">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false })}
          </span>
        </div>
        
        <p className="text-sm text-zinc-200 mb-2 leading-snug">{comment.text}</p>
        
        <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
          <button className="hover:text-zinc-300 transition-colors" onClick={handleReply}>
            Reply
          </button>
          {comment.replyCount > 0 && (
            <button className="hover:text-zinc-300 transition-colors text-blue-400">
              View {comment.replyCount} replies
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <button 
          onClick={handleLike}
          className={cn(
            "p-1.5 -mr-1.5 rounded-full hover:bg-zinc-800 transition-colors",
            isLiked ? "text-rose-500" : "text-zinc-500 hover:text-rose-400"
          )}
        >
          <Heart size={16} className={cn(isLiked && "fill-current")} />
        </button>
        {likesCount > 0 && (
          <span className={cn("text-[11px] font-medium", isLiked ? "text-rose-500" : "text-zinc-500")}>
            {likesCount}
          </span>
        )}
      </div>
    </div>
  );
}
