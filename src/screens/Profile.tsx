import React, { useState } from 'react';
import { Settings, LogOut, Grid3X3, Film, Heart } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function Profile() {
  const { currentUser, logout, requireAuth } = useAppContext();
  const [userPosts, setUserPosts] = useState<any[]>([]);

  // If viewing guest state or own profile
  const user = currentUser;

  if (!user) {
    return (
      <div className="flex flex-col h-full bg-black items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
          <UserIcon />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Create your profile</h2>
        <p className="text-zinc-400 mb-8 max-w-sm">
          Sign in to customize your profile, track your local feed, and sync your network across devices.
        </p>
        <button 
          onClick={() => requireAuth('Create Account', 'Sign in to setup your profile.', () => {})}
          className="bg-white text-black font-semibold py-3.5 px-8 rounded-full text-base hover:bg-zinc-200 transition-colors w-full max-w-xs"
        >
          Create Account or Log in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">{user.username}</h1>
        <div className="flex gap-4">
          <button className="text-zinc-400 hover:text-white transition-colors">
            <Settings size={22} />
          </button>
          <button onClick={logout} className="text-rose-500 hover:text-rose-400 transition-colors">
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {/* Profile Info */}
        <div className="px-4 pt-6 pb-6 border-b border-zinc-900">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-800">
              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-6 text-center flex-1 justify-center">
              <div>
                <div className="font-bold text-xl text-white">0</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Posts</div>
              </div>
              <div>
                <div className="font-bold text-xl text-white">{user.followers?.toLocaleString() || 0}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Followers</div>
              </div>
              <div>
                <div className="font-bold text-xl text-white">{user.following?.toLocaleString() || 0}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Following</div>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <h2 className="font-bold text-white text-base">{user.displayName}</h2>
            <p className="text-zinc-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{user.bio}</p>
          </div>
          
          <div className="flex gap-2">
            <button className="flex-1 bg-zinc-900 border border-zinc-800 text-white font-semibold py-2 rounded-xl text-sm hover:bg-zinc-800 transition-colors">
              Edit Profile
            </button>
            <button className="flex-1 bg-zinc-900 border border-zinc-800 text-white font-semibold py-2 rounded-xl text-sm hover:bg-zinc-800 transition-colors">
              Share Profile
            </button>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex items-center border-b border-zinc-900 sticky top-[69px] z-20 bg-black/90 backdrop-blur-md">
          <button className="flex-1 py-3 flex justify-center text-white relative">
            <Grid3X3 size={20} />
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-t-full bg-white"></span>
          </button>
          <button className="flex-1 py-3 flex justify-center text-zinc-600 hover:text-zinc-400 transition-colors">
            <Film size={20} />
          </button>
          <button className="flex-1 py-3 flex justify-center text-zinc-600 hover:text-zinc-400 transition-colors">
            <Heart size={20} />
          </button>
        </div>

        {/* Grid */}
        <div className="pt-0.5 min-h-[300px]">
          {userPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {userPosts.map((post, i) => (
                <div key={i} className="aspect-square bg-zinc-900">
                  <img src={post.content} alt="Post thumbnail" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 mt-10">
              <div className="w-16 h-16 rounded-full border-2 border-zinc-800 flex items-center justify-center mb-4">
                <Grid3X3 size={24} className="text-zinc-600" />
              </div>
              <p className="text-white font-medium mb-1">No posts yet</p>
              <p className="text-sm">When you share photos and videos, they'll appear here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
