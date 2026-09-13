import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { ArrowLeft, Film } from 'lucide-react';
import { Post } from '../types';

export function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data);
        }
      } catch (e) {
        console.error('Failed to load post:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  return (
    <div className="flex flex-col h-full w-full bg-black relative overflow-hidden">
      <button 
        onClick={() => navigate(-1)} 
        aria-label="Back to feed"
        className="absolute top-4 left-4 z-50 p-2.5 bg-black/60 hover:bg-black/80   rounded-full text-white transition-colors"
      >
        <ArrowLeft size={20} />
      </button>
      
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="text-xs">Loading video...</span>
        </div>
      ) : post ? (
        <div className="flex-1 h-full w-full">
          <PostCard post={post} isActive={true} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04]  flex items-center justify-center text-slate-500 mb-3">
            <Film size={28} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Post not found</h2>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            This video may have been removed or the link is incorrect.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            Explore Feed
          </button>
        </div>
      )}
    </div>
  );
}
