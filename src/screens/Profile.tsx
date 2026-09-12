import React, { useState, useEffect, useRef } from 'react';
import { Settings, LogOut, Grid3X3, Film, Heart, X, Upload, Plus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { PostCard } from '../components/PostCard';
import { Post } from '../types';
import { globalSyncEngine } from '../sync/sync_engine';

export function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, logout, requireAuth, syncState } = useAppContext();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const targetId = id || currentUser?.id;
    if (!targetId) return;
    
    if (targetId === currentUser?.id) {
      setViewUser(currentUser);
    } else {
      // Fetch other user profile
      fetch(`/api/user/${targetId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
             // Map from db snake_case if necessary or just use object
             setViewUser({
               ...data,
               id: data.uid,
               followersCount: data.followersCount,
               followingCount: data.followingCount
             });
          }
        })
        .catch(console.error);
    }
  }, [id, currentUser]);

  const user = viewUser;
  const isMe = user?.id === currentUser?.id;

  useEffect(() => {
    if (!isMe && user?.id && currentUser) {
      auth.currentUser?.getIdToken().then(token => {
        fetch(`/api/follow/${user.id}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setIsFollowing(data.isFollowing))
        .catch(console.error);
      });
    }
  }, [isMe, user?.id, currentUser]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetch(`/api/user/posts/${user.id || user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setUserPosts(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    const handleEvent = (event: any) => {
      if (event.operation === 'CREATE' && event.payload?.targetType === 'POST' && event.authorId === user?.id) {
        const newPost = {
          ...event.payload.data,
          id: event.objectId,
          authorId: event.authorId,
          createdAt: event.hlc,
          author: user,
          isLikedByMe: false
        };
        setUserPosts(prev => [newPost, ...prev]);
      } else if (event.payload?.targetType === 'POST') {
        setUserPosts(prev => prev.map(p => {
          if (p.id === event.objectId) {
            let updated = { ...p };
            if (event.operation === 'LIKE') updated.likesCount = (updated.likesCount || 0) + 1;
            if (event.operation === 'UNLIKE') updated.likesCount = Math.max(0, (updated.likesCount || 0) - 1);
            if (event.operation === 'REPOST') updated.repostsCount = (updated.repostsCount || 0) + 1;
            if (event.operation === 'CREATE' && event.payload?.type === 'COMMENT') updated.commentsCount = (updated.commentsCount || 0) + 1;
            return updated;
          }
          return p;
        }));
      }
    };
    globalSyncEngine.onEvent(handleEvent);
    
    // We should ideally remove the listener on unmount, but SyncEngine doesn't have offEvent.
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col h-full bg-black items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
          <UserIcon />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Profile not found</h2>
        <p className="text-zinc-500 mb-6 text-sm">Please sign in to view your profile</p>
        <button 
          onClick={() => requireAuth('Profile', 'Sign in to see your profile, posts, and saved collections.', () => {})}
          className="bg-white text-black font-semibold px-8 py-3 rounded-full hover:bg-zinc-200 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative">
      <header className="absolute top-0 w-full z-30 pt-safe px-4 py-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto drop-shadow-md">
          <h1 className="text-lg font-bold text-white tracking-tight">{user.username}</h1>
          <span className="text-[10px] bg-zinc-800/80 backdrop-blur-md px-1.5 py-0.5 rounded text-zinc-300 font-medium">v1.0</span>
        </div>
        
        {isMe && (
          <div className="flex items-center gap-4 pointer-events-auto">
            <button className="text-white drop-shadow-md"><Settings size={22} /></button>
            <button onClick={logout} className="text-rose-500 drop-shadow-md"><LogOut size={22} /></button>
          </div>
        )}
      </header>
      
      <main className="flex-1 overflow-y-auto hide-scrollbar pt-safe">
        <div className="px-4 pt-14 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border border-zinc-800">
              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
            </div>
            
            <div className="flex gap-6 text-center flex-1 justify-center">
              <div>
                <div className="font-bold text-xl text-white">{userPosts.length}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Posts</div>
              </div>
              <div className="cursor-pointer">
                <div className="font-bold text-xl text-white">{user.followersCount?.toLocaleString() || 0}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Followers</div>
              </div>
              <div className="cursor-pointer">
                <div className="font-bold text-xl text-white">{user.followingCount?.toLocaleString() || 0}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Following</div>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <h2 className="font-bold text-white text-base">{user.displayName}</h2>
            <p className="text-zinc-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{user.bio}</p>
          </div>
          
          <div className="flex gap-2">
            {isMe ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-white font-semibold py-2 rounded-xl text-sm hover:bg-zinc-800 transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <button 
                onClick={() => {
                  requireAuth('Follow', 'Sign in to follow.', async () => {
                    setIsFollowing(!isFollowing);
                    try {
                      const token = await auth.currentUser?.getIdToken();
                      const res = await fetch(`/api/follow/${user.id}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const data = await res.json();
                      setIsFollowing(data.followed);
                      setViewUser((prev: any) => ({ ...prev, followersCount: (prev.followersCount || 0) + (data.followed ? 1 : -1) }));
                    } catch (e) { setIsFollowing(!isFollowing); }
                  });
                }}
                className={`flex-1 ${isFollowing ? 'bg-zinc-800' : 'bg-rose-500'} text-white font-semibold py-2 rounded-xl text-sm hover:opacity-90 transition-colors flex justify-center items-center gap-1`}
              >
                {!isFollowing && <Plus size={16} strokeWidth={3} />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center border-b border-zinc-900 sticky top-[69px] z-20 bg-black/90 backdrop-blur-md">
          <button className="flex-1 py-3 flex justify-center text-white relative">
            <Grid3X3 size={20} />
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-t-full bg-white"></span>
          </button>
        </div>

        <div className="pt-0.5 min-h-[300px]">
          {loading ? (
            <div className="text-center py-10 text-zinc-600">Loading...</div>
          ) : userPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {userPosts.map((post) => (
                <div key={post.id} className="aspect-[3/4] bg-zinc-900 relative">
                  {post.type === 'video' ? (
                     <video src={post.content} className="w-full h-full object-cover" />
                  ) : (
                     <img src={post.content} className="w-full h-full object-cover" />
                  )}
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

      {isEditing && (
        <EditProfileModal user={user} onClose={() => setIsEditing(false)} />
      )}
    </div>
  );
}

function EditProfileModal({ user, onClose }: { user: any, onClose: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image too large. Max 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName,
          username,
          bio,
          avatar
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }
      
      // Force reload to get updated context
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between border-b border-zinc-900">
        <button onClick={onClose} className="text-white font-medium hover:text-zinc-300">
          Cancel
        </button>
        <h2 className="text-white font-bold tracking-tight text-lg">Edit profile</h2>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="text-blue-400 font-bold hover:text-blue-300 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {error && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">{error}</div>}
        
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={20} className="text-white mb-1" />
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="text-blue-400 font-medium text-sm">
            Change profile photo
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Name</label>
          <input 
            type="text" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600 transition-colors"
          />
          <p className="text-xs text-zinc-500 mt-1">You can only change your username once every 30 days.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Bio</label>
          <textarea 
            value={bio} 
            onChange={e => setBio(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600 transition-colors min-h-[100px] resize-none"
          />
        </div>
      </div>
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
