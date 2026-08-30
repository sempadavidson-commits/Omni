import React, { useState, useEffect } from 'react';
import { X, Send, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { useAppContext } from '../../context/AppContext';
import { Comment } from '../../types';

interface CommentModalProps {
  postId: string;
  onClose: () => void;
}

export function CommentModal({ postId, onClose }: CommentModalProps) {
  const { currentUser, requireAuth, dispatchEvent } = useAppContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // Load real comments for this post
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/comments/${postId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error('Failed to fetch comments', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [postId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    requireAuth('Comment', 'Sign in to join the conversation.', () => {
      if (!currentUser) return;

      const commentData: Comment = {
        id: 'c_' + Math.random().toString(36).substring(7),
        postId,
        authorId: currentUser.id,
        author: currentUser,
        text: newComment,
        likesCount: 0,
        createdAt: new Date().toISOString(),
        replyCount: 0
      };

      // Optimistic UI update
      setComments(prev => [commentData, ...prev]);
      setNewComment('');

      // Dispatch local CREATE event to Sync Engine
      dispatchEvent({
        objectId: commentData.id,
        operation: 'CREATE',
        payload: { targetType: 'COMMENT', data: commentData }
      });
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className="fixed inset-x-0 bottom-0 z-50 h-[80vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-[100%] duration-300 max-w-md mx-auto">
        
        {/* Handle */}
        <div className="w-full flex justify-center pt-3 pb-2" onClick={onClose}>
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
        </div>

        <div className="flex justify-between items-center px-4 pb-3 border-b border-zinc-900">
          <h2 className="text-sm font-bold text-white tracking-wide">Comments <span className="text-zinc-500 font-normal ml-1">{comments.length}</span></h2>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar pt-2 pb-4">
          {comments.length > 0 ? (
            comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8 text-center space-y-2">
              <MessageCircle size={40} className="text-zinc-800 mb-2" />
              <p className="text-white font-medium">No comments yet.</p>
              <p className="text-sm">Be the first to start the conversation.</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950 pb-safe">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0">
              {currentUser ? (
                <img src={currentUser.avatar} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <UserIcon />
                </div>
              )}
            </div>
            
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-1 flex items-end focus-within:border-zinc-700 transition-colors">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full bg-transparent text-white text-sm px-3 py-2.5 max-h-32 resize-none outline-none placeholder-zinc-500"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              <button 
                type="submit"
                disabled={!newComment.trim()}
                className="p-2 mb-1 mr-1 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function UserIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
