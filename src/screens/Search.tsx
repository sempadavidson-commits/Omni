import React, { useState, useEffect } from 'react';
import {
  Search as SearchIcon,
  ArrowLeft,
  X,
  TrendingUp,
  Clock,
  User,
  Film,
  Hash,
  Play,
  Heart,
  Plus,
  Check
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { User as UserType, Post } from '../types';

const TRENDING_TAGS = ['#omni', '#creative', '#motion', '#cinematic', '#pulse', '#tech', '#lifestyle'];

export function Search() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'top' | 'users' | 'videos' | 'tags'>('top');
  const [results, setResults] = useState<{ users: UserType[]; posts: Post[]; tags: string[] }>({
    users: [],
    posts: [],
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('omni_recent_searches');
      return stored ? JSON.parse(stored) : ['#creative', 'omni'];
    } catch {
      return ['#creative', 'omni'];
    }
  });

  const navigate = useNavigate();
  const { currentUser, requireAuth } = useAppContext();
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  // Save query to recents
  const saveRecentSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem('omni_recent_searches', JSON.stringify(updated));
    } catch {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('omni_recent_searches');
    } catch {}
  };

  // Perform search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], posts: [], tags: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&filter=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setResults({
            users: data.users || [],
            posts: data.posts || [],
            tags: data.tags || []
          });
          saveRecentSearch(query);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const handleFollowUser = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    requireAuth('Follow', 'Sign in to follow creators.', async () => {
      const nextFollowed = !followedUserIds.has(targetUserId);
      setFollowedUserIds(prev => {
        const next = new Set(prev);
        if (nextFollowed) next.add(targetUserId);
        else next.delete(targetUserId);
        return next;
      });

      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`/api/follow/${targetUserId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // revert on error
        setFollowedUserIds(prev => {
          const next = new Set(prev);
          if (nextFollowed) next.delete(targetUserId);
          else next.add(targetUserId);
          return next;
        });
      }
    });
  };

  const hasResults =
    results.users.length > 0 || results.posts.length > 0 || results.tags.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white overflow-hidden">
      {/* Search Header */}
      <header className="pt-safe px-3 py-2.5 border-b  bg-[#07080c]/90  flex items-center gap-2 shrink-0 z-30">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-1 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Input Pill */}
        <div className="flex-1 bg-white/[0.06] rounded-full flex items-center px-3.5 h-10  focus-within:border-cyan-400/50 transition-colors">
          <SearchIcon size={16} className="text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, videos, or #tags..."
            className="bg-transparent border-none outline-none text-white w-full text-xs placeholder-slate-500"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-white p-1 rounded-full shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Segmented Result Tabs (Only visible when searching) */}
      {query.trim() && (
        <div className="flex items-center px-4 border-b border-white/[0.06] bg-[#07080c] shrink-0 text-xs font-semibold overflow-x-auto hide-scrollbar">
          {(['top', 'users', 'videos', 'tags'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-2.5 px-3 uppercase tracking-wider relative transition-colors whitespace-nowrap",
                activeTab === tab ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Results or Discovery Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
            Searching Omni network...
          </div>
        ) : query.trim() ? (
          // Active Search Results View
          !hasResults ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04]  flex items-center justify-center text-slate-500 mb-3">
                <SearchIcon size={24} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No results found</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                We couldn't find any matches for "{query}". Try checking your spelling or explore trending hashtags.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Users Result Section */}
              {(activeTab === 'top' || activeTab === 'users') && results.users.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} className="text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Creators</h3>
                  </div>
                  <div className="space-y-2">
                    {results.users.map((user) => {
                      const isFollowed = followedUserIds.has(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => navigate(`/profile/${user.id}`)}
                          className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={user.avatar}
                              alt={user.displayName}
                              className="w-11 h-11 rounded-full object-cover bg-slate-800 "
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-white truncate">{user.displayName}</h4>
                              <p className="text-xs text-cyan-400 truncate">@{user.username}</p>
                              {user.bio && (
                                <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">{user.bio}</p>
                              )}
                            </div>
                          </div>

                          {currentUser?.id !== user.id && (
                            <button
                              onClick={(e) => handleFollowUser(e, user.id)}
                              className={cn(
                                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                isFollowed
                                  ? "bg-white/[0.08] text-slate-300 "
                                  : "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                              )}
                            >
                              {isFollowed ? <Check size={13} /> : <Plus size={13} strokeWidth={3} />}
                              {isFollowed ? 'Following' : 'Follow'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {(activeTab === 'top' || activeTab === 'tags') && results.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hash size={15} className="text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Hashtags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {results.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setQuery(tag)}
                        className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20  hover:border-cyan-400/50 text-cyan-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Hash size={12} className="text-cyan-400" />
                        {tag.replace(/^#/, '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos Grid Section */}
              {(activeTab === 'top' || activeTab === 'videos') && results.posts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Film size={15} className="text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Videos & Posts</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {results.posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="aspect-[9/14] rounded-xl overflow-hidden bg-white/[0.03]  relative group cursor-pointer"
                      >
                        {post.type === 'video' ? (
                          <video
                            src={post.content}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={post.content}
                            alt={post.caption || 'Post media'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}

                        {/* Bottom Overlay Info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                          <p className="text-[11px] text-white font-medium line-clamp-2 leading-tight drop-shadow mb-1.5">
                            {post.caption || `@${post.author?.username}`}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-300">
                            <span className="flex items-center gap-1">
                              <Heart size={11} className="text-cyan-400 fill-cyan-400" />
                              {post.likesCount || 0}
                            </span>
                            {post.type === 'video' && <Play size={12} className="text-white fill-white" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          // Pre-search Discovery Landing
          <div className="space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Clock size={14} className="text-cyan-400" />
                    <span>Recent Searches</span>
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08]  text-xs text-slate-300 transition-colors flex items-center gap-1.5"
                    >
                      <SearchIcon size={12} className="text-slate-500" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Topics */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                <TrendingUp size={14} className="text-cyan-400" />
                <span>Trending on Omni</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TRENDING_TAGS.map((tag, idx) => (
                  <div
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="p-3 rounded-xl bg-white/[0.03] hover:bg-cyan-500/[0.08] border-white/[0.06] hover: cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 block">
                        {tag}
                      </span>
                      <span className="text-[10px] text-slate-500">Trending #{idx + 1}</span>
                    </div>
                    <Hash size={14} className="text-slate-500 group-hover:text-cyan-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
