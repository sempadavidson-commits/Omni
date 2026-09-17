import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Compass, Users, Video, RefreshCw, Radio } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { FeedCardSkeleton } from '../components/OmniSkeleton';
import { Post } from '../types';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { globalSyncEngine } from '../sync/sync_engine';
import { cn } from '../lib/utils';
import { getApiUrl } from '../lib/api';
import { getFirestoreFeed } from '../services/firestoreService';

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    requireAuth,
    feedPosts: posts,
    setFeedPosts: setPosts,
    feedActiveIndex: activeIndex,
    setFeedActiveIndex: setActiveIndex,
    feedPage: page,
    setFeedPage: setPage,
    feedHasMore: hasMore,
    setFeedHasMore: setHasMore,
    feedActiveTab: activeTab,
    setFeedActiveTab: setActiveTab
  } = useAppContext();

  const [loading, setLoading] = useState(posts.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'following' && activeTab !== 'following') {
      setActiveTab('following');
    } else if (tabParam === 'foryou' && activeTab !== 'foryou') {
      setActiveTab('foryou');
    }
  }, [searchParams, activeTab, setActiveTab]);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (tab: 'foryou' | 'following', pageToFetch: number, isAppend: boolean = false) => {
    let retries = 3;
    try {
      while (retries > 0) {
        try {
          const headers: Record<string, string> = {};
          if (auth.currentUser) {
            try {
              const token = await auth.currentUser.getIdToken();
              headers['Authorization'] = `Bearer ${token}`;
            } catch (tokenErr) {
              console.warn('Could not get auth token for feed fetch:', tokenErr);
            }
          }
          
          const res = await fetch(getApiUrl(`/api/feed?tab=${tab}&page=${pageToFetch}&limit=10`), { headers });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              const incoming: Post[] = Array.isArray(data) ? data : [];
              if (incoming.length > 0) {
                if (isAppend) {
                  setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newUnique = incoming.filter(p => p.id && !existingIds.has(p.id));
                    return [...prev, ...newUnique];
                  });
                } else {
                  const seen = new Set<string>();
                  const uniqueIncoming = incoming.filter(p => {
                    if (!p.id || seen.has(p.id)) return false;
                    seen.add(p.id);
                    return true;
                  });
                  setPosts(uniqueIncoming);
                }
                setHasMore(incoming.length >= 10);
                setPage(pageToFetch);
                break; // Exit retry loop on success
              }
            }
          }

          // Fallback to Firestore feed (e.g. for Vercel deployment)
          try {
            const fsPosts = await getFirestoreFeed(tab, auth.currentUser?.uid, 20);
            if (fsPosts && fsPosts.length > 0) {
              if (isAppend) {
                setPosts(prev => {
                  const existingIds = new Set(prev.map(p => p.id));
                  const newUnique = fsPosts.filter(p => p.id && !existingIds.has(p.id));
                  return [...prev, ...newUnique];
                });
              } else {
                setPosts(fsPosts);
              }
              setHasMore(false);
              break;
            }
          } catch (fsErr) {
            console.warn('Firestore feed fallback note:', fsErr);
          }
        } catch (err) {
          retries--;
          if (retries === 0) {
            console.warn('Could not fetch feed after retries:', err);
            // Final attempt to load Firestore feed
            try {
              const fsPosts = await getFirestoreFeed(tab, auth.currentUser?.uid, 20);
              if (fsPosts && fsPosts.length > 0 && !isAppend) {
                setPosts(fsPosts);
              }
            } catch {}
          } else {
            await new Promise(r => setTimeout(r, 400));
          }
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [setPosts, setHasMore, setPage]);

  // Prevent initial fetch from overwriting feed states when navigating back
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (posts.length > 0) {
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setPage(0);
    setHasMore(true);
    fetchFeed(activeTab, 0, false);
  }, [activeTab, fetchFeed, posts.length, setPage, setHasMore]);

  // Restore scroll position to active index on mount
  useEffect(() => {
    if (containerRef.current && posts.length > 0 && activeIndex > 0) {
      const container = containerRef.current;
      const timer = setTimeout(() => {
        const targetElement = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
        if (targetElement) {
          targetElement.scrollIntoView({ block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [posts.length, activeIndex]);

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
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      }
    };
    const unsubscribe = globalSyncEngine.onEvent(handleEvent);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentUser, setPosts]);

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
  }, [posts, activeIndex, setActiveIndex]);

  // Track pagination when reaching near end
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    
    // Trigger pagination when reaching near bottom (less than 400px remaining)
    if (scrollHeight - scrollTop - clientHeight < 400 && hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      fetchFeed(activeTab, page + 1, true);
    }
  };

  // Live followed users tracking for top button
  const [followedLiveUsers, setFollowedLiveUsers] = useState<any[]>([]);
  const [activeLiveUserIndex, setActiveLiveUserIndex] = useState(0);

  useEffect(() => {
    // Check if any followed users are currently live
    let isMounted = true;
    (async () => {
      try {
        if (!currentUser) return;
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/user/${currentUser.id}/following`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && isMounted) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const liveOnly = list.filter((u: any) => u.isLive);
            setFollowedLiveUsers(liveOnly);
          }
        }
      } catch (e) {
        console.warn('Could not fetch followed live users:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Alternate between followed live users if multiple are live
  useEffect(() => {
    if (followedLiveUsers.length <= 1) return;
    const interval = setInterval(() => {
      setActiveLiveUserIndex((prev) => (prev + 1) % followedLiveUsers.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [followedLiveUsers]);

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

  const handleHidePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] relative overflow-hidden">
      {/* Omni Top Navigation Header (Overlaid on Media) */}
      <header className="absolute top-0 left-0 right-0 z-30 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none select-none">
        {/* Left: Search Action Button */}
        <button
          onClick={() => navigate('/search')}
          aria-label="Search and Explore"
          className="pointer-events-auto p-2.5 rounded-full bg-black/30 hover:bg-black/50 text-white hover:text-cyan-400 transition-colors active:scale-95 shadow-md"
        >
          <Search size={20} strokeWidth={2.2} />
        </button>

        {/* Center: Following & For You Tabs */}
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

        {/* Right: Functional LIVE Section Button (SVG, No border, No glow unless friend/followed is live) */}
        {followedLiveUsers.length > 0 ? (
          <button
            onClick={() => navigate('/live')}
            aria-label="Live Broadcasts"
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-all active:scale-95 shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-in fade-in duration-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <img
              src={followedLiveUsers[activeLiveUserIndex]?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=live'}
              alt="Live user"
              className="w-4 h-4 rounded-full object-cover shrink-0"
            />
            <span className="text-xs font-bold truncate max-w-[80px]">
              {followedLiveUsers[activeLiveUserIndex]?.displayName || followedLiveUsers[activeLiveUserIndex]?.username}
            </span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/live')}
            aria-label="Live Broadcasts"
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 text-slate-200 hover:text-white hover:bg-black/60 transition-colors active:scale-95"
          >
            <Radio size={16} className="text-slate-300" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Live
            </span>
          </button>
        )}
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
              key={`${post.id}-${idx}`}
              data-post-card="true"
              data-index={idx}
              className="w-full h-full snap-start snap-always shrink-0 relative"
            >
              <PostCard
                post={post}
                isActive={idx === activeIndex}
                compact={false}
                onHidePost={handleHidePost}
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
                : 'Be the pioneer to post the first video on Omni!'}
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
