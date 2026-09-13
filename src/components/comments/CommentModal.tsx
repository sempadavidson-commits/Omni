import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { useAppContext } from '../../context/AppContext';
import { Comment } from '../../types';
import { auth } from '../../lib/firebase';
import { telemetry } from '../../lib/telemetry';

interface CommentModalProps {
  postId: string;
  onClose: () => void;
}

export function CommentModal({ postId, onClose }: CommentModalProps) {
  const { currentUser, requireAuth, dispatchEvent } = useAppContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${postId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load comments.');
      }
    } catch (err) {
      console.error('Failed to fetch comments', err);
      setError('Network error. Check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleReplyTo = (username: string) => {
    setNewComment(`@${username} `);
    inputRef.current?.focus();
  };

  const handleDeleteComment = async (commentId: string) => {
    // Optimistic removal
    const previous = [...comments];
    setComments(prev => prev.filter(c => c.id !== commentId));

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        // Rollback
        setComments(previous);
      }
    } catch {
      setComments(previous);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    requireAuth('Comment', 'Sign in to join the conversation.', async () => {
      if (!currentUser) return;
      setIsSubmitting(true);

      const commentId = crypto.randomUUID();
      const commentData: Comment = {
        id: commentId,
        postId,
        authorId: currentUser.id,
        author: currentUser,
        text: newComment.trim(),
        likesCount: 0,
        createdAt: new Date().toISOString(),
        replyCount: 0
      };

      // Optimistic UI update
      const previousComments = [...comments];
      setComments(prev => [commentData, ...prev]);
      const commentText = newComment.trim();
      setNewComment('');

      telemetry.track({
        type: 'comment',
        postId,
        creatorId: currentUser.id
      });

      try {
        // Dispatch event through sync engine & server
        dispatchEvent({
          objectId: commentData.id,
          operation: 'CREATE',
          payload: { targetType: 'COMMENT', data: { postId, text: commentText } }
        });
      } catch (err) {
        // Rollback on submission failure
        setComments(previousComments);
        setError('Failed to send comment. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/75  animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className="fixed inset-x-0 bottom-0 z-50 h-[80vh] max-h-[640px] bg-[#07080c] border-t  rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 max-w-md mx-auto">
        
        {/* Drag handle */}
        <div className="w-full flex justify-center pt-3 pb-2 cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pb-3 border-b ">
          <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>Comments</span>
            <span className="text-cyan-400 font-bold">({comments.length})</span>
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 -mr-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comments Feed Area */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pt-2 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
              <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
              Loading conversation...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <AlertCircle size={32} className="text-rose-400 mb-2" />
              <p className="text-xs text-rose-300 mb-3">{error}</p>
              <button
                onClick={fetchComments}
                className="px-4 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-xs font-bold text-cyan-400 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : comments.length > 0 ? (
            comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={handleReplyTo}
                onDelete={handleDeleteComment}
              />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04]  flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                <MessageCircle size={24} />
              </div>
              <p className="text-sm font-bold text-white mb-1">No comments yet</p>
              <p className="text-xs text-slate-500">Be the first to share your thoughts on this video.</p>
            </div>
          )}
        </div>

        {/* Input Dock (Keyboard-Safe) */}
        <div className="p-3 border-t  bg-[#07080c] pb-safe">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0 ">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                  ?
                </div>
              )}
            </div>
            
            <div className="flex-1 bg-white/[0.05]  rounded-2xl px-3.5 py-1.5 flex items-center focus-within:border-cyan-400/50 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={currentUser ? "Add a comment (mention with @)..." : "Sign in to join the conversation..."}
                maxLength={280}
                className="w-full bg-transparent text-white text-xs outline-none placeholder-slate-500 py-1"
              />
              <button 
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className="p-1.5 ml-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-20 disabled:hover:text-cyan-400 transition-all active:scale-95"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
