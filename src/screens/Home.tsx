import React from 'react';
import { Radio, Search, Users, Video } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { StoryRail } from '../components/StoryRail';
import { ScreenState } from '../components/ui/ScreenState';
import { Post } from '../types';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { getApiUrl } from '../lib/api';

export function Home() {
  const [params] = useSearchParams();
  const { currentUser, requireAuth, feedPosts: posts, setFeedPosts: setPosts, feedActiveIndex: activeIndex, setFeedActiveIndex: setActiveIndex, feedPage: page, setFeedPage: setPage, feedHasMore: hasMore, setFeedHasMore: setHasMore, feedActiveTab: tab, setFeedActiveTab: setTab } = useAppContext();
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>(posts.length ? 'ready' : 'loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const load = React.useCallback(async (nextTab: 'foryou' | 'following', nextPage = 0, append = false) => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    if (!append) setState('loading'); else setLoadingMore(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(getApiUrl(`/api/feed?tab=${nextTab}&page=${nextPage}&limit=10`), { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Feed returned an invalid response');
      setPosts(previous => { const source = append ? [...previous, ...payload] : payload; const seen = new Set<string>(); return source.filter((post: Post) => Boolean(post?.id) && !seen.has(post.id) && Boolean(seen.add(post.id))); });
      setPage(nextPage); setHasMore(payload.length === 10); setState('ready');
    } catch (error: any) { if (error?.name !== 'AbortError') setState('error'); }
    finally { if (requestRef.current === controller) requestRef.current = null; setLoadingMore(false); }
  }, [setPosts, setPage, setHasMore]);

  React.useEffect(() => { const requested = params.get('tab') === 'following' ? 'following' : 'foryou'; if (requested !== tab) setTab(requested); }, [params]);
  React.useEffect(() => { if (!posts.length) void load(tab); return () => requestRef.current?.abort(); }, [tab]);

  React.useEffect(() => {
    const root = containerRef.current; if (!root || !posts.length) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting && entry.intersectionRatio >= .6) setActiveIndex(Number(entry.target.getAttribute('data-index') || 0)); }), { root, threshold: [.6] });
    root.querySelectorAll('[data-index]').forEach(node => observer.observe(node)); return () => observer.disconnect();
  }, [posts, setActiveIndex]);

  const changeTab = (next: 'foryou' | 'following') => {
    if (next === 'following' && !currentUser) return requireAuth('Following', 'Sign in to see creators you follow.', () => changeTab(next));
    if (next === tab) return; setTab(next); setActiveIndex(0); containerRef.current?.scrollTo({ top: 0 }); void load(next);
  };

  const onScroll = () => { const node = containerRef.current; if (!node || !hasMore || loadingMore || state !== 'ready') return; if (node.scrollHeight - node.scrollTop - node.clientHeight < 500) void load(tab, page + 1, true); };

  return <div className="relative h-full overflow-hidden bg-black">
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-4 pb-8 pt-safe"><button onClick={() => navigate('/search')} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur-lg" aria-label="Discover"><Search size={20}/></button><nav className="pointer-events-auto flex items-center gap-6">{(['following','foryou'] as const).map(value => <button key={value} onClick={() => changeTab(value)} className={cn('relative py-2 text-sm font-semibold', tab === value ? 'text-white' : 'text-white/55')}>{value === 'foryou' ? 'For you' : 'Following'}{tab === value && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-omni-accent"/>}</button>)}</nav><button onClick={() => navigate('/live')} className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full bg-black/35 px-3 text-xs font-semibold text-white backdrop-blur-lg"><Radio size={16} className="text-omni-accent"/>Live</button></header>
    <StoryRail/>
    <main ref={containerRef} onScroll={onScroll} className="h-full snap-y snap-mandatory overflow-y-auto hide-scrollbar">
      {state === 'loading' && <div className="h-full bg-omni-bg"><ScreenState kind="loading" title="Loading your feed"/></div>}
      {state === 'error' && <div className="h-full bg-omni-bg"><ScreenState kind="error" title="Your feed could not load" description="Nothing was replaced with mock content." actionLabel="Try again" onAction={() => load(tab)}/></div>}
      {state === 'ready' && posts.length === 0 && <div className="h-full bg-omni-bg"><ScreenState kind="empty" icon={tab === 'following' ? <Users/> : <Video/>} title={tab === 'following' ? 'Your following feed is quiet' : 'No Moments yet'} description={tab === 'following' ? 'Follow creators to build this feed.' : 'Publish the first real Moment.'} actionLabel={tab === 'following' ? 'Explore for you' : 'Create a Moment'} onAction={() => tab === 'following' ? changeTab('foryou') : navigate('/create')}/></div>}
      {state === 'ready' && posts.map((post, index) => <div key={post.id} data-index={index} className="h-full snap-start snap-always"><PostCard post={post} isActive={index === activeIndex} onHidePost={id => setPosts(previous => previous.filter(item => item.id !== id))}/></div>)}
      {loadingMore && <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">Loading more…</div>}
    </main>
  </div>;
}
