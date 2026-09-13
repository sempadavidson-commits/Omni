import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Compass, Users, Video, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { FeedCardSkeleton } from '../components/OmniSkeleton';
import { Post } from '../types';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { globalSyncEngine } from '../sync/sync_engine';
import { cn } from '../lib/utils';

export function Home() {
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const { currentUser, requireAuth } = useAppContext();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (tab: 'foryou' | 'following', pageToFetch: number, isAppend: boolean = false) => {
    try {
      const headers: Record<string, string> = {};
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/feed?tab=${tab}&page=${pageToFetch}&limit=10`, { headers });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          const incoming: Post[] = Array.isArray(data) ? data : [];
          if (isAppend) {
            setPosts(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              const newUnique = incoming.filter(p => !existingIds.has(p.id));
              return [...prev, ...newUnique];
            });
          } else {
            setPosts(incoming);
          }
          setHasMore(incoming.length >= 10);
          setPage(pageToFetch);
        } else {
          if (!isAppend) setPosts([]);
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    setHasMore(true);
    fetchFeed(activeTab, 0, false);
  }, [activeTab, fetchFeed]);

  // Listen to new posts created locally via Sync Engine
  useEffect(() => {
    const handleEvent = (event: any) => {
      if (event.operation === 'CREATE' && event.payload?.targetType === 'POST') {
        const newPost: Post = {
          ...event.payload.data,
          id: event.objectId,
          authorId: event.authorId,
          createdAt: event.hlc,
          likesCount: 0,
          commentsCount: 0,
          repostsCount: 0,
          sharesCount: 0,
          viewsCount: 0,
          author: currentUser || undefined,
        };
        setPosts(prev => [newPost, ...prev]);
      }
    };
    globalSyncEngine.onEvent(handleEvent);
  }, [currentUser]);

  // Set up IntersectionObserver to update activeIndex on visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index) && index !== activeIndex) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: [0.5, 0.75]
      }
    );

    const elements = container.querySelectorAll('[data-post-card]');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [posts, activeIndex]);

  // Track active visible post via scroll listener and trigger pagination
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight > 0) {
      const newIndex = Math.round(scrollTop / clientHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < posts.length) {
        setActiveIndex(newIndex);
      }

      // Trigger pagination when reaching near end
      if (newIndex >= posts.length - 2 && hasMore && !loadingMore && !loading) {
        setLoadingMore(true);
        fetchFeed(activeTab, page + 1, true);
      }
    }
  };

  const handleTabChange = (tab: 'foryou' | 'following') => {
    if (tab === 'following' && !currentUser) {
      requireAuth('Following Feed', 'Sign in to view posts from creators you follow.', () => {
        setActiveTab('following');
      });
      return;
    }
    setActiveTab(tab);
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] relative overflow-hidden">
      {/* Omni Top Navigation Header (Overlaid on Media) */}
      <header className="absolute top-0 left-0 right-0 z-30 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none select-none">
        {/* Left: Search Action Button */}
        <button
          onClick={() => navigate('/search')}
          aria-label="Search and Explore"
          className="pointer-events-auto p-2.5 rounded-full bg-white/10 hover:bg-white/[0.15] text-white hover:text-cyan-400 transition-colors active:scale-95 shadow-lg"
        >
          <Search size={20} strokeWidth={2.2} />
        </button>

        {/* Center: Real Following & For You Tabs */}
        <div className="pointer-events-auto flex items-center justify-center gap-6">
          <button
            onClick={() => handleTabChange('following')}
            className={cn(
              "relative text-base font-bold transition-all duration-200 py-1 drop-shadow-md",
              activeTab === 'following'
                ? "text-white scale-105"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Following
            {activeTab === 'following' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('foryou')}
            className={cn(
              "relative text-base font-bold transition-all duration-200 py-1 drop-shadow-md",
              activeTab === 'foryou'
                ? "text-white scale-105"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            For You
            {activeTab === 'foryou' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>
        </div>

        {/* Right: Quick Refresh */}
        <button
          onClick={() => {
            setRefreshing(true);
            fetchFeed(activeTab, 0, false);
          }}
          aria-label="Refresh Feed"
          className="pointer-events-auto p-2.5 rounded-full bg-white/10 hover:bg-white/[0.15] text-white hover:text-cyan-400 transition-colors active:scale-95 shadow-lg"
        >
          <RefreshCw size={18} strokeWidth={2.2} className={cn(refreshing && "animate-spin text-cyan-400")} />
        </button>
      </header>

      {/* Main Snap Scroll Viewport with Full-Screen Height and Mandatory Snap Points */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 w-full h-full snap-y snap-mandatory overflow-y-scroll hide-scrollbar scroll-smooth"
      >
        {loading ? (
          <FeedCardSkeleton />
        ) : posts.length > 0 ? (
          posts.map((post, idx) => (
            <div
              key={post.id}
              data-post-card="true"
              data-index={idx}
              className="w-full h-full snap-start snap-always shrink-0 relative"
            >
              <PostCard
                post={post}
                isActive={idx === activeIndex}
                compact={false}
              />
            </div>
          ))
        ) : (
          /* Real informative empty state */
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-[#07080c]">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_25px_rgba(0,240,255,0.15)]">
              {activeTab === 'following' ? <Users size={32} /> : <Video size={32} />}
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              {activeTab === 'following' ? 'No posts from creators you follow' : 'No posts yet'}
            </h3>
            
            <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
              {activeTab === 'following'
                ? 'Follow your favorite creators to see their latest videos and updates in this feed.'
                : 'Be the pioneer to publish the first story on Omni!'}
            </p>

            <div className="flex items-center gap-3">
              {activeTab === 'following' ? (
                <button
                  onClick={() => setActiveTab('foryou')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-[#07080c] font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                >
                  Explore For You
                </button>
              ) : (
                <button
                  onClick={() => navigate('/create')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-[#07080c] font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                >
                  Create Video
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
