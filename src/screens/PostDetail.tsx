import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { ArrowLeft, Film } from 'lucide-react';
import { Post } from '../types';

export function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const passedList = location.state?.postsList;
    const initialIdx = location.state?.initialIndex ?? 0;

    if (Array.isArray(passedList) && passedList.length > 0) {
      setPosts(passedList);
      setActiveIndex(initialIdx);
      setLoading(false);
    } else {
      const loadPostAndFeed = async () => {
        try {
          const [postRes, feedRes] = await Promise.all([
            fetch(`/api/posts/${id}`),
            fetch('/api/feed?tab=foryou&limit=15')
          ]);

          let targetPost: Post | null = null;
          if (postRes.ok) {
            targetPost = await postRes.json();
          }

          let feedPosts: Post[] = [];
          if (feedRes.ok) {
            feedPosts = await feedRes.json();
          }

          if (targetPost) {
            const combined = [targetPost, ...feedPosts.filter(p => p.id !== targetPost!.id)];
            setPosts(combined);
            setActiveIndex(0);
          } else if (feedPosts.length > 0) {
            setPosts(feedPosts);
            setActiveIndex(0);
          }
        } catch (e) {
          console.error('Failed to load post detail:', e);
        } finally {
          setLoading(false);
        }
      };
      loadPostAndFeed();
    }
  }, [id, location.state]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight > 0) {
      const idx = Math.round(scrollTop / clientHeight);
      if (idx !== activeIndex && idx >= 0 && idx < posts.length) {
        setActiveIndex(idx);
      }
    }
  };

  useEffect(() => {
    if (containerRef.current && activeIndex > 0) {
      containerRef.current.scrollTop = activeIndex * containerRef.current.clientHeight;
    }
  }, [loading]);

  const handleHidePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <div className="flex flex-col h-full w-full bg-black relative overflow-hidden">
      {/* Floating Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        aria-label="Back to grid"
        className="absolute top-4 left-4 z-50 p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full text-white transition-colors shadow-lg"
      >
        <ArrowLeft size={20} />
      </button>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Loading stream...</span>
        </div>
      ) : posts.length > 0 ? (
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        >
          {posts.map((p, idx) => (
            <div key={`${p.id}-${idx}`} className="h-full w-full snap-start">
              <PostCard 
                post={p} 
                isActive={idx === activeIndex}
                onHidePost={handleHidePost}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center text-slate-500 mb-3">
            <Film size={28} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Video not found</h2>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            This video may have been removed or deleted.
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
