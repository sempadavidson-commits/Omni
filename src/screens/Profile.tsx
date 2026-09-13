import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  LogOut,
  Grid3X3,
  Bookmark,
  Heart,
  Share2,
  Edit3,
  Plus,
  Check,
  Play,
  X,
  Upload,
  User as UserIcon,
  Users,
  ExternalLink,
  MessageCircle,
  UserPlus,
  ArrowLeft,
  LogIn,
  Eye
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { Post, User } from '../types';
import { cn } from '../lib/utils';

export function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, logout, requireAuth, updateCurrentUser } = useAppContext();

  const [activeTab, setActiveTab] = useState<'created' | 'saved' | 'liked'>('created');
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const [viewUser, setViewUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // User list modal (followers / following)
  const [userListModal, setUserListModal] = useState<{ title: string; users: User[] } | null>(null);

  const targetId = id || currentUser?.id;
  const isMe = !id || id === currentUser?.id;

  // Load user profile
  useEffect(() => {
    if (!targetId || targetId === 'undefined' || targetId === 'null') {
      // If navigating directly to /profile without being logged in, auto-trigger auth modal
      if (!currentUser) {
        requireAuth('Profile', 'Sign in to access your profile.', () => {});
      }
      return;
    }

    if (isMe && currentUser) {
      setViewUser(currentUser);
    } else {
      fetch(`/api/user/${targetId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setViewUser({
              ...data,
              id: data.uid,
              followersCount: data.followersCount,
              followingCount: data.followingCount,
            });
          }
        })
        .catch(console.error);
    }
  }, [targetId, isMe, currentUser]);

  const user = viewUser;

  // Check follow status if viewing another user
  useEffect(() => {
    if (!isMe && user?.id && user.id !== 'undefined' && user.id !== 'null' && currentUser) {
      auth.currentUser?.getIdToken().then(token => {
        fetch(`/api/follow/${user.id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => setIsFollowing(data.isFollowing))
          .catch(console.error);
      });
    }
  }, [isMe, user?.id, currentUser]);

  // Load content for active tab
  useEffect(() => {
    if (!user?.id || user.id === 'undefined' || user.id === 'null') return;
    setLoading(true);

    if (activeTab === 'created') {
      fetch(`/api/user/posts/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (activeTab === 'saved') {
      fetch(`/api/user/saved/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setSavedPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (activeTab === 'liked') {
      fetch(`/api/user/likes/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setLikedPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user?.id, activeTab]);

  const handleFollowToggle = () => {
    if (!user) return;
    requireAuth('Follow', 'Sign in to follow creators.', async () => {
      const nextFollowed = !isFollowing;
      setIsFollowing(nextFollowed);
      setViewUser((prev: any) => ({
        ...prev,
        followersCount: Math.max(0, (prev.followersCount || 0) + (nextFollowed ? 1 : -1))
      }));

      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`/api/follow/${user.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // revert
        setIsFollowing(!nextFollowed);
      }
    });
  };

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/profile/${user.id}`;
    if (navigator.share) {
      navigator.share({
        title: `${user.displayName} on Omni`,
        text: `Check out @${user.username}'s videos on Omni!`,
        url: profileUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(profileUrl).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      });
    }
  };

  const openFollowersList = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/${user.id}/followers`);
      if (res.ok) {
        const data = await res.json();
        setUserListModal({ title: 'Followers', users: data });
      }
    } catch (e) {}
  };

  const openFollowingList = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/${user.id}/following`);
      if (res.ok) {
        const data = await res.json();
        setUserListModal({ title: 'Following', users: data });
      }
    } catch (e) {}
  };

  if (!user) {
    return (
      <div className="flex flex-col h-full w-full bg-[#07080c] items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10  flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          <UserIcon size={32} />
        </div>
        <h2 className="text-xl font-bold mb-1">Profile Not Found</h2>
        <p className="text-xs text-slate-400 mb-6 max-w-xs">
          Sign in or create an account to view and customize your Omni creator profile.
        </p>
        <button
          onClick={() => requireAuth('Profile', 'Sign in to access your profile.', () => {})}
          className="px-6 py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Active items list based on tab
  const activeItems =
    activeTab === 'created' ? posts : activeTab === 'saved' ? savedPosts : likedPosts;

  const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white relative overflow-hidden">
      {/* Top Profile Header with Accessible Action Triggers on Top-Left */}
      <header className="pt-safe px-3 py-2.5 flex items-center justify-between bg-[#07080c]/95 border-b border-white/[0.04] shrink-0 z-30">
        {/* Left Side: SVG Action Triggers */}
        <div className="flex items-center gap-1">
          {isMe ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                title="Edit Profile"
                aria-label="Edit Profile"
                className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-cyan-400 transition-colors active:scale-95"
              >
                <Edit3 size={18} />
              </button>

              <button
                onClick={() => requireAuth('Switch', 'Switch to another account', () => {})}
                title="Switch Account"
                aria-label="Switch Account"
                className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-cyan-400 transition-colors active:scale-95"
              >
                <UserPlus size={18} />
              </button>

              <button
                onClick={() => {
                  logout();
                  navigate('/', { replace: true });
                }}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-2 rounded-full hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors active:scale-95"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate(-1)}
              title="Go Back"
              aria-label="Go Back"
              className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors active:scale-95"
            >
              <ArrowLeft size={19} />
            </button>
          )}

          {!currentUser && (
            <button
              onClick={() => requireAuth('Profile', 'Sign in to access your profile.', () => {})}
              title="Sign In"
              aria-label="Sign In"
              className="p-2 rounded-full hover:bg-white/[0.08] text-cyan-400 transition-colors active:scale-95 flex items-center gap-1.5 text-xs font-bold"
            >
              <LogIn size={18} />
            </button>
          )}
        </div>

        {/* Center: Username */}
        <div className="flex items-center justify-center px-2">
          <span className="text-sm font-extrabold text-white tracking-tight truncate max-w-[160px]">
            @{user.username}
          </span>
        </div>

        {/* Right Side: Share Trigger */}
        <div className="flex items-center gap-1">
          {copiedToast && (
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-400/40 animate-pulse">
              Copied!
            </span>
          )}
          <button
            onClick={handleShareProfile}
            title="Share Profile"
            aria-label="Share profile"
            className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors active:scale-95"
          >
            <Share2 size={18} />
          </button>
        </div>
      </header>

      {/* Main Profile Body */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {/* User Card: Avatar and Side-Positioned Profile Info */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-row items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.15)] bg-slate-800 border-2 border-white/10 overflow-hidden">
                <img
                  src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=omni'}
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>

            {/* Side Profile Info: Display Name, Username, Bio */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="text-lg font-extrabold text-white leading-tight truncate">
                {user.displayName}
              </h2>
              <p className="text-xs text-cyan-400 font-semibold mt-0.5 truncate">
                @{user.username}
              </p>

              {user.bio ? (
                <p className="text-xs text-slate-300 leading-relaxed mt-2 whitespace-pre-wrap line-clamp-3">
                  {user.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic mt-2">No bio yet</p>
              )}

              {/* Action Buttons for Viewing Other Creators */}
              {!isMe && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleFollowToggle}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95",
                      isFollowing
                        ? "bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]"
                        : "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                    )}
                  >
                    {isFollowing ? <Check size={13} /> : <Plus size={13} strokeWidth={3} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={() => navigate('/inbox')}
                    className="py-1.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-all flex items-center justify-center gap-1"
                  >
                    <MessageCircle size={13} />
                    Message
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Stats Rail: Videos, Followers, Following, Total Likes */}
          <div className="grid grid-cols-4 gap-2 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.04]">
            <div className="flex flex-col items-center justify-center py-1">
              <span className="text-sm font-extrabold text-white">
                {posts.length}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                Videos
              </span>
            </div>

            <div
              onClick={openFollowersList}
              className="flex flex-col items-center justify-center py-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-sm font-extrabold text-white">
                {user.followersCount?.toLocaleString() || 0}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                Followers
              </span>
            </div>

            <div
              onClick={openFollowingList}
              className="flex flex-col items-center justify-center py-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-sm font-extrabold text-white">
                {user.followingCount?.toLocaleString() || 0}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                Following
              </span>
            </div>

            <div className="flex flex-col items-center justify-center py-1">
              <span className="text-sm font-extrabold text-rose-400 flex items-center gap-1">
                <Heart size={12} className="fill-rose-400" />
                {totalLikes.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                Total Likes
              </span>
            </div>
          </div>
        </div>

        {/* Content Tabs: Videos / Saved / Liked alongside Total Likes summary */}
        <div className="sticky top-0 z-20 bg-[#07080c]/95 backdrop-blur-md border-b border-white/[0.05] flex items-center justify-around mt-2">
          <button
            onClick={() => setActiveTab('created')}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold relative transition-colors",
              activeTab === 'created' ? "text-cyan-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Grid3X3 size={16} />
            <span>Videos ({posts.length})</span>
            {activeTab === 'created' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold relative transition-colors",
              activeTab === 'saved' ? "text-amber-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Bookmark size={16} />
            <span>Saved</span>
            {activeTab === 'saved' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('liked')}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold relative transition-colors",
              activeTab === 'liked' ? "text-rose-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Heart size={16} />
            <span>Liked</span>
            {activeTab === 'liked' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
            )}
          </button>
        </div>

        {/* Total Likes Highlight Bar alongside Post Grid */}
        <div className="px-3 pt-2.5 pb-1 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {activeTab === 'created' ? 'Creator Portfolio' : activeTab === 'saved' ? 'Saved Collections' : 'Liked Videos'}
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-semibold">
            <Heart size={12} className="text-rose-400 fill-rose-400" />
            {totalLikes.toLocaleString()} total likes received
          </span>
        </div>

        {/* Tab Content Grid */}
        <div className="p-1 min-h-[260px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
              Loading {activeTab}...
            </div>
          ) : activeItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/post/${item.id}`)}
                  className="aspect-[9/13] rounded-lg overflow-hidden bg-slate-900 border-white/[0.04] relative group cursor-pointer"
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.content}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.content}
                      alt={item.caption || 'Post image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-2">
                    <div className="flex items-center gap-2 text-[10px] text-white">
                      {item.type === 'video' && (
                        <span className="flex items-center gap-1 font-semibold">
                          <Play size={10} fill="white" />
                          {item.viewsCount || 0}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-semibold">
                        <Heart size={10} className="text-cyan-400 fill-cyan-400" />
                        {item.likesCount || 0}
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <MessageCircle size={10} />
                        {item.commentsCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border-white/[0.06] flex items-center justify-center mb-3 text-slate-400">
                {activeTab === 'created' ? (
                  <Grid3X3 size={24} />
                ) : activeTab === 'saved' ? (
                  <Bookmark size={24} />
                ) : (
                  <Heart size={24} />
                )}
              </div>
              <p className="text-sm font-bold text-white mb-1">
                {activeTab === 'created'
                  ? 'No videos published yet'
                  : activeTab === 'saved'
                  ? 'No saved bookmarks'
                  : 'No liked videos'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {activeTab === 'created'
                  ? 'Create and share your first video to showcase your work.'
                  : activeTab === 'saved'
                  ? 'Tap the bookmark icon on any video to save it for later.'
                  : 'Double-tap or like videos in your feed to see them collected here.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditing && (
        <EditProfileSheet
          user={user}
          onClose={() => setIsEditing(false)}
          onUpdated={(updated) => {
            setViewUser((prev: any) => ({ ...prev, ...updated }));
            updateCurrentUser(updated);
            setIsEditing(false);
          }}
        />
      )}

      {/* Followers / Following List Modal */}
      {userListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80  p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0f1118]  p-4 shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between pb-3 border-b  mb-3">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                {userListModal.title}
              </h3>
              <button
                onClick={() => setUserListModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2">
              {userListModal.users.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No {userListModal.title.toLowerCase()} found.
                </div>
              ) : (
                userListModal.users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setUserListModal(null);
                      navigate(`/profile/${u.id}`);
                    }}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-white truncate">
                          {u.displayName}
                        </div>
                        <div className="text-[11px] text-cyan-400 truncate">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditProfileSheet({
  user,
  onClose,
  onUpdated
}: {
  user: any;
  onClose: () => void;
  onUpdated: (updated: Partial<User>) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError('Image must be under 8MB.');
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, username, bio, avatar })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onUpdated({
        displayName: data.displayName,
        username: data.username,
        bio: data.bio,
        avatar: data.avatar,
      });
    } catch (err: any) {
      setError(err.message || 'Error saving profile');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07080c] flex flex-col">
      <header className="pt-safe px-4 py-3 border-b  flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          Cancel
        </button>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Edit Profile
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1 rounded-full bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-md mx-auto w-full">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border-red-500/30 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* Change Avatar */}
        <div className="flex flex-col items-center gap-2 py-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 border-2 border-cyan-400/40 relative group cursor-pointer shadow-lg"
          >
            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={18} className="text-white" />
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleAvatarFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-cyan-400 hover:underline"
          >
            Change Photo
          </button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-white/[0.04]  rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50"
            maxLength={40}
          />
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Username (@handle)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            className="w-full bg-white/[0.04]  rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50"
            maxLength={30}
          />
          <p className="text-[10px] text-slate-500">
            Letters, numbers, and underscores only. Cooldown of 30 days applies after change.
          </p>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={180}
            className="w-full bg-white/[0.04]  rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50 resize-none"
            placeholder="Introduce yourself to the Omni community..."
          />
          <span className="text-[10px] text-slate-500 text-right">
            {bio.length} / 180
          </span>
        </div>
      </div>
    </div>
  );
}
