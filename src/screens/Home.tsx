import React, { useEffect, useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { Post } from '../types';
import { auth } from '../lib/firebase';
import { globalSyncEngine } from '../sync/sync_engine';

export function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
    
    const unsubscribe = auth.onAuthStateChanged(() => fetchFeed());
    
    const handleEvent = (event: any) => {
      if (event.operation === 'CREATE' && event.payload?.targetType === 'POST') {
        const newPost = {
          ...event.payload.data,
          id: event.objectId,
          authorId: event.authorId,
          createdAt: event.hlc,
        };
        setPosts(prev => [newPost, ...prev]);
      }
    };
    globalSyncEngine.onEvent(handleEvent);

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Header - Overlays Content */}
      <header className="absolute top-0 left-0 right-0 z-30 pt-safe px-4 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none drop-shadow-md">
        <button onClick={() => navigate('/search')} className="p-2 text-white pointer-events-auto hover:text-zinc-300 transition-colors drop-shadow-md">
          <Search size={26} strokeWidth={2.5} />
        </button>
        
        <div className="flex items-center justify-center gap-5 pointer-events-auto">
          <button className="text-lg font-bold text-white relative shadow-black drop-shadow-md">
            For You
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white"></span>
          </button>
          <button className="text-lg font-bold text-white/70 hover:text-white transition-colors drop-shadow-md">
            Following
          </button>
        </div>

        <div className="w-10">
          {/* Placeholder to balance the flex space for the Search icon */}
        </div>
      </header>

      {/* Feed Content - Full screen snap scrolling */}
      <main className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory hide-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white text-sm animate-pulse">Loading feed...</div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <div className="h-full flex items-center justify-center flex-col gap-2">
            <p className="text-zinc-500">No posts found.</p>
            <p className="text-sm text-zinc-600">Start the conversation!</p>
          </div>
        )}
      </main>
    </div>
  );
}
