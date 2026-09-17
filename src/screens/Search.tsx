import React from 'react';
import { ArrowLeft, Check, Clock, Hash, Heart, Plus, Search as SearchIcon, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { User, Post } from '../types';
import { ScreenState } from '../components/ui/ScreenState';
import { cn } from '../lib/utils';

interface Results { users: User[]; posts: Post[]; tags: string[] }
const EMPTY: Results = { users: [], posts: [], tags: [] };

export function Search() {
  const [params] = useSearchParams();
  const [query, setQuery] = React.useState(params.get('q') || '');
  const [tab, setTab] = React.useState<'top' | 'users' | 'videos' | 'tags'>('top');
  const [results, setResults] = React.useState<Results>(EMPTY);
  const [state, setState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [following, setFollowing] = React.useState<Set<string>>(new Set());
  const [recent, setRecent] = React.useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('omni_recent_searches') || '[]'); } catch { return []; } });
  const navigate = useNavigate();
  const { currentUser, requireAuth } = useAppContext();

  React.useEffect(() => {
    const text = query.trim();
    if (!text) { setResults(EMPTY); setState('idle'); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState('loading');
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(text)}&filter=${tab}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const payload = await response.json();
        setResults({ users: Array.isArray(payload.users) ? payload.users : [], posts: Array.isArray(payload.posts) ? payload.posts : [], tags: Array.isArray(payload.tags) ? payload.tags : [] });
        setState('ready');
        setRecent(previous => { const next = [text, ...previous.filter(item => item.toLowerCase() !== text.toLowerCase())].slice(0, 8); try { localStorage.setItem('omni_recent_searches', JSON.stringify(next)); } catch {} return next; });
      } catch (error: any) { if (error?.name !== 'AbortError') setState('error'); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, tab]);

  const toggleFollow = (event: React.MouseEvent, userId: string) => {
    event.stopPropagation();
    requireAuth('Follow', 'Sign in to follow creators.', async () => {
      const wasFollowing = following.has(userId);
      setFollowing(previous => { const next = new Set(previous); wasFollowing ? next.delete(userId) : next.add(userId); return next; });
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(`/api/follow/${userId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Follow failed');
      } catch { setFollowing(previous => { const next = new Set(previous); wasFollowing ? next.add(userId) : next.delete(userId); return next; }); }
    });
  };

  const hasResults = results.users.length + results.posts.length + results.tags.length > 0;
  return <div className="flex h-full flex-col overflow-hidden bg-omni-bg text-[var(--omni-text-primary)]">
    <header className="z-20 shrink-0 border-b border-[var(--omni-border-subtle)] bg-[rgba(11,11,10,.94)] px-3 pb-3 pt-safe backdrop-blur-xl"><div className="flex items-center gap-2"><button onClick={() => navigate(-1)} aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.08]"><ArrowLeft size={20}/></button><label className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-[var(--omni-border-subtle)] bg-[var(--omni-bg-surface)] px-3 focus-within:border-[var(--omni-accent)]"><SearchIcon size={17} className="text-[var(--omni-text-muted)]"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="People, moments and topics" autoFocus className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--omni-text-muted)]"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button>}</label></div>{query.trim() && <nav aria-label="Search filters" className="mt-3 flex gap-1 overflow-x-auto">{(['top','users','videos','tags'] as const).map(value => <button key={value} onClick={() => setTab(value)} className={cn('rounded-full px-4 py-2 text-xs font-semibold capitalize', tab === value ? 'bg-omni-accent text-[#0b0b0a]' : 'bg-white/[0.05] text-[var(--omni-text-secondary)]')}>{value}</button>)}</nav>}</header>
    <main className="flex-1 overflow-y-auto px-4 pb-24">
      {state === 'idle' && <div className="py-6"><div className="rounded-[28px] border border-[var(--omni-border-subtle)] bg-gradient-to-br from-[var(--omni-bg-surface)] to-[var(--omni-bg-elevated)] p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-omni-accent">Discover Omni</p><h1 className="mt-2 max-w-xs text-3xl font-semibold leading-tight tracking-tight">Find people and moments worth keeping.</h1><p className="mt-3 text-sm leading-6 text-[var(--omni-text-secondary)]">Search live community content—no invented trends or placeholder recommendations.</p></div>{recent.length > 0 && <section className="mt-7"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Clock size={16}/>Recent</h2><button onClick={() => { setRecent([]); localStorage.removeItem('omni_recent_searches'); }} className="text-xs text-[var(--omni-text-muted)]">Clear</button></div><div className="mt-3 flex flex-wrap gap-2">{recent.map(term => <button key={term} onClick={() => setQuery(term)} className="rounded-full border border-[var(--omni-border-subtle)] bg-[var(--omni-bg-surface)] px-3 py-2 text-sm">{term}</button>)}</div></section>}</div>}
      {state === 'loading' && <ScreenState kind="loading" title="Searching Omni"/>}{state === 'error' && <ScreenState kind="error" title="Search is unavailable" description="Check your connection and try again." actionLabel="Try again" onAction={() => setQuery(value => `${value} `)}/>} {state === 'ready' && !hasResults && <ScreenState kind="empty" title="No matches" description={`Nothing matched “${query.trim()}”. Try another name, topic or phrase.`}/>} 
      {state === 'ready' && hasResults && <div className="space-y-7 py-5">{(tab === 'top' || tab === 'users') && results.users.length > 0 && <section><h2 className="mb-3 text-sm font-semibold">People</h2><div className="flex gap-3 overflow-x-auto pb-1">{results.users.map(user => <article key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="w-40 shrink-0 cursor-pointer rounded-[22px] border border-[var(--omni-border-subtle)] bg-[var(--omni-bg-surface)] p-3"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[var(--omni-bg-elevated)]">{user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover"/> : user.displayName?.slice(0,1)}</span>{currentUser?.id !== user.id && <button onClick={event => toggleFollow(event, user.id)} aria-label={following.has(user.id) ? 'Unfollow' : 'Follow'} className="grid h-9 w-9 place-items-center rounded-full bg-omni-accent text-[#0b0b0a]">{following.has(user.id) ? <Check size={16}/> : <Plus size={16}/>}</button>}</div><h3 className="mt-3 truncate text-sm font-semibold">{user.displayName}</h3><p className="truncate text-xs text-[var(--omni-text-muted)]">@{user.username}</p></article>)}</div></section>}{(tab === 'top' || tab === 'tags') && results.tags.length > 0 && <section><h2 className="mb-3 text-sm font-semibold">Topics</h2><div className="flex flex-wrap gap-2">{results.tags.map(tag => <button key={tag} onClick={() => setQuery(tag)} className="flex items-center gap-1 rounded-full bg-[var(--omni-accent-soft)] px-3 py-2 text-sm text-omni-accent"><Hash size={14}/>{tag.replace(/^#/,'')}</button>)}</div></section>}{(tab === 'top' || tab === 'videos') && results.posts.length > 0 && <section><h2 className="mb-3 text-sm font-semibold">Moments</h2><div className="grid grid-cols-2 gap-2">{results.posts.map(post => { const source = post.thumbnailUrl || post.mediaUrl || post.content || `/api/posts/${post.id}/media`; return <button key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[var(--omni-bg-surface)] text-left">{post.type === 'video' && !post.thumbnailUrl ? <video src={source} muted playsInline preload="metadata" className="h-full w-full object-cover"/> : <img src={source} alt="" loading="lazy" className="h-full w-full object-cover"/>}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10"><span className="line-clamp-2 text-xs font-medium">{post.caption || `@${post.author?.username || 'creator'}`}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-white/75"><Heart size={11}/>{post.likesCount || 0}</span></span></button>; })}</div></section>}</div>}
    </main>
  </div>;
}
