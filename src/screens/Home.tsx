import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { PostCard } from '../components/PostCard';
import { SyncIndicator } from '../components/SyncIndicator';
import { Post } from '../types';
import { auth } from '../lib/firebase';
import { globalSyncEngine } from '../sync/sync_engine';

export function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const headers: Record<string, string> = {};
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch('/api/feed', { headers });
        if (res.ok) {
          const data = await res.json();
          setPosts(data);
        }
      } catch (err) {
        console.error('Failed to fetch feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
    
    // Refresh on auth state change
    const unsubscribe = auth.onAuthStateChanged(() => fetchFeed());
    
    // Also optimistic update listener
    const handleEvent = (event: any) => {
      if (event.operation === 'CREATE' && event.payload?.targetType === 'POST') {
        const newPost = {
          ...event.payload.data,
          id: event.objectId,
          authorId: event.authorId,
          createdAt: event.hlc,
        };
        // Optimistic UI insert
        setPosts(prev => [newPost, ...prev]);
      }
    };
    globalSyncEngine.onEvent(handleEvent);

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-xl tracking-tighter">
            N
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">Nexus</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <SyncIndicator />
          <button className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <Search size={18} />
          </button>
        </div>
      </header>
      
      {/* Feed Filter / Tabs */}
      <div className="flex items-center justify-center gap-8 border-b border-zinc-900 sticky top-[61px] z-20 bg-black/90 backdrop-blur-md">
        <button className="py-3 text-sm font-semibold text-white relative">
          For You
          <span className="absolute bottom-0 left-0 w-full h-1 rounded-t-full bg-blue-500"></span>
        </button>
        <button className="py-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
          Following
        </button>
      </div>

      {/* Feed Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        <div className="pt-2">
          {loading ? (
            <div className="text-center py-10 text-zinc-600 text-sm animate-pulse">Loading feed...</div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-10 text-zinc-600 text-sm">
              No posts found. Start the conversation!
            </div>
          )}
          {!loading && posts.length > 0 && (
            <div className="text-center py-10 text-zinc-600 text-sm">
              You've caught up for now.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
