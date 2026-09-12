import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, ArrowLeft, User, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '../components/PostCard';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }
    
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="px-4 py-3 border-b border-zinc-900 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 bg-zinc-900 rounded-full flex items-center px-4 h-10">
          <SearchIcon size={18} className="text-zinc-500 mr-2" />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users or posts..." 
            className="bg-transparent border-none outline-none text-white w-full text-sm"
            autoFocus
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Searching...</div>
        ) : query && results.users.length === 0 && results.posts.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">No results found for "{query}"</div>
        ) : (
          <div>
            {results.users.length > 0 && (
              <div className="mb-6">
                <h3 className="text-white font-bold px-4 py-2 text-sm tracking-wide bg-zinc-900/50">Users</h3>
                {results.users.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 cursor-pointer" onClick={() => navigate(`/profile/${u.uid}`)}>
                    <img src={u.avatar} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
                    <div>
                      <div className="text-white font-medium text-sm">{u.displayName}</div>
                      <div className="text-zinc-500 text-xs">@{u.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.posts.length > 0 && (
              <div>
                <h3 className="text-white font-bold px-4 py-2 text-sm tracking-wide bg-zinc-900/50">Posts</h3>
                <div className="grid grid-cols-3 gap-1">
                  {results.posts.map((p: any) => (
                    <div key={p.id} className="aspect-square bg-zinc-800 relative cursor-pointer" onClick={() => navigate(`/post/${p.id}`)}>
                      {p.type === 'video' ? (
                        <video src={p.content} className="w-full h-full object-cover" />
                      ) : (
                        <img src={p.content} className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
