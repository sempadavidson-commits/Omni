import React, { useState, useEffect, useRef } from 'react';
import {
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
  MessageCircle,
  UserPlus,
  ArrowLeft,
  LogIn,
  Eye,
  Send,
  Repeat2,
  Film,
  UserCheck,
  ShieldCheck,
  Trash2,
  Pin
} from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { Post, User } from '../types';
import { cn } from '../lib/utils';

export function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    logout,
    requireAuth,
    updateCurrentUser,
    savedAccounts,
    switchAccount,
    removeSavedAccount,
    activeUploads,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'created' | 'saved' | 'liked'>('created');
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const [viewUser, setViewUser] = useState<any>(null);
  const [followStatus, setFollowStatus] = useState<{
    isFollowing: boolean;
    isFollowedBy: boolean;
    isFriend: boolean;
  }>({ isFollowing: false, isFollowedBy: false, isFriend: false });

  const [isEditing, setIsEditing] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // User list modal (followers / following)
  const [userListModal, setUserListModal] = useState<{ title: string; users: User[] } | null>(null);

  // Determine if viewing own profile
  const isMe =
    !id ||
    (currentUser &&
      (id === currentUser.id ||
        id === currentUser.uid ||
        id === currentUser.username));

  const targetId = isMe ? currentUser?.id : id;

  // Load user profile
  useEffect(() => {
    setViewUser(null);
    setPosts([]);
    setSavedPosts([]);
    setLikedPosts([]);

    if (!targetId || targetId === 'undefined' || targetId === 'null') {
      if (!currentUser && !id) {
        requireAuth('Profile', 'Sign in to access your profile.', () => {});
      }
      return;
    }

    if (isMe && currentUser) {
      setViewUser(currentUser);
    } else {
      fetch(`/api/user/${targetId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setViewUser({
              ...data,
              id: data.uid || data.id,
              followersCount: data.followersCount || 0,
              followingCount: data.followingCount || 0,
            });
          }
        })
        .catch(console.error);
    }
  }, [targetId, isMe, currentUser, id]);

  const user = isMe ? (currentUser || viewUser) : viewUser;

  // Check follow & friend status if viewing another creator
  useEffect(() => {
    if (!isMe && user?.id && user.id !== 'undefined' && user.id !== 'null' && currentUser) {
      auth.currentUser?.getIdToken().then((token) => {
        fetch(`/api/follow/${user.id}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && typeof data === 'object') {
              setFollowStatus({
                isFollowing: Boolean(data.isFollowing),
                isFollowedBy: Boolean(data.isFollowedBy),
                isFriend: Boolean(data.isFriend || (data.isFollowing && data.isFollowedBy)),
              });
            }
          })
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
        .then((res) => res.json())
        .then((data) => {
          setPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (activeTab === 'saved') {
      fetch(`/api/user/saved/${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          setSavedPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (activeTab === 'liked') {
      fetch(`/api/user/likes/${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          setLikedPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user?.id, activeTab, location.pathname, location.key]);

  const handleFollowToggle = () => {
    if (!user) return;
    requireAuth('Follow', 'Sign in to connect with creators.', async () => {
      const nextFollowing = !followStatus.isFollowing;
      const nextFriend = nextFollowing && followStatus.isFollowedBy;

      setFollowStatus((prev) => ({
        ...prev,
        isFollowing: nextFollowing,
        isFriend: nextFriend,
      }));

      setViewUser((prev: any) => ({
        ...prev,
        followersCount: Math.max(0, (prev?.followersCount || 0) + (nextFollowing ? 1 : -1)),
      }));

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/follow/${user.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data && typeof data.followed === 'boolean') {
          setFollowStatus((prev) => ({
            ...prev,
            isFollowing: data.followed,
            isFriend: data.followed && prev.isFollowedBy,
          }));
        }
      } catch (e) {
        // revert
        setFollowStatus((prev) => ({
          ...prev,
          isFollowing: !nextFollowing,
          isFriend: !nextFollowing && prev.isFollowedBy,
        }));
      }
    });
  };

  const handleMessageUser = () => {
    if (!user || isMe || user.id === currentUser?.id || user.id === currentUser?.uid) return;
    requireAuth('Message', 'Sign in to message this creator.', () => {
      navigate(
        `/messages?user=${user.id}&name=${encodeURIComponent(user.displayName || '')}&username=${encodeURIComponent(
          user.username || ''
        )}&avatar=${encodeURIComponent(user.avatar || '')}`
      );
    });
  };

  const handleShareProfile = () => {
    if (!user) return;
    const profileUrl = `${window.location.origin}/profile/${user.id || user.username}`;
    if (navigator.share) {
      navigator
        .share({
          title: `${user.displayName} on Omni`,
          text: `Check out ${user.displayName} (@${user.username}) on Omni!`,
          url: profileUrl,
        })
        .catch(() => {});
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
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/user/${user.id}/followers`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUserListModal({ title: 'Followers', users: data });
      }
    } catch (e) {}
  };

  const openFollowingList = async () => {
    if (!user?.id) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/user/${user.id}/following`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUserListModal({ title: 'Following', users: data });
      }
    } catch (e) {}
  };

  if (!user) {
    return (
      <div className="flex flex-col h-full w-full bg-[#07080c] items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
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
  const rawActiveItems =
    activeTab === 'created' ? posts : activeTab === 'saved' ? savedPosts : likedPosts;

  const activeItems = [...rawActiveItems].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const handleTogglePin = async (e: React.MouseEvent, postId: string, currentPinned?: boolean) => {
    e.stopPropagation();
    const newPinned = !currentPinned;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: newPinned } : p));
    try {
      let token = await auth.currentUser?.getIdToken();
      if (!token && currentUser?.id) token = 'mock_token_' + currentUser.id;
      await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isPinned: newPinned })
      });
    } catch (err) {}
  };

  const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalViews = posts.reduce((sum, p) => sum + (p.viewsCount || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.sharesCount || 0), 0);
  const totalReposts = posts.reduce((sum, p) => sum + (p.repostsCount || 0), 0);
  const totalSaves = posts.reduce((sum, p) => sum + (p.bookmarksCount || 0), 0);

  // Follow Button Text and Icon logic
  const renderFollowButton = () => {
    if (followStatus.isFriend) {
      return (
        <button
          onClick={handleFollowToggle}
          className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/25 active:scale-95"
        >
          <UserCheck size={14} className="text-cyan-400" />
          <span>Friends</span>
        </button>
      );
    }
    if (followStatus.isFollowedBy && !followStatus.isFollowing) {
      return (
        <button
          onClick={handleFollowToggle}
          className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-400 to-indigo-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)] hover:brightness-110 active:scale-95"
        >
          <UserPlus size={14} />
          <span>Add Back</span>
        </button>
      );
    }
    if (followStatus.isFollowing) {
      return (
        <button
          onClick={handleFollowToggle}
          className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white/[0.08] text-slate-300 hover:bg-white/[0.12] active:scale-95"
        >
          <Check size={14} />
          <span>Following</span>
        </button>
      );
    }
    return (
      <button
        onClick={handleFollowToggle}
        className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)] active:scale-95"
      >
        <Plus size={14} strokeWidth={3} />
        <span>Follow</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white relative overflow-hidden">
      {/* Top Profile Header: Displays User's Name (not username) + top-left action icons */}
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
                onClick={() => setIsAccountSwitcherOpen(true)}
                title="Switch Account"
                aria-label="Switch Account"
                className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-cyan-400 transition-colors active:scale-95 relative"
              >
                <Users size={18} />
                {savedAccounts.length > 1 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
                )}
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

        {/* Center: Top View shows User's Name */}
        <div className="flex items-center justify-center px-2">
          <span className="text-sm font-extrabold text-white tracking-tight truncate max-w-[170px]">
            {user.displayName || 'Creator'}
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
        <div className="p-4 flex flex-col gap-4">
          {/* User Card: Avatar and Side-Positioned Profile Info */}
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

            {/* Side Profile Info: Username & Bio */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="text-base font-extrabold text-cyan-400 leading-tight truncate">
                @{user.username}
              </h2>

              {user.bio ? (
                <p className="text-xs text-slate-300 leading-relaxed mt-1.5 whitespace-pre-wrap line-clamp-3">
                  {user.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic mt-1.5">No bio yet</p>
              )}

              {/* Action Buttons for Viewing Other Creators */}
              {!isMe && (
                <div className="flex items-center gap-2 mt-3">
                  {renderFollowButton()}
                  <button
                    onClick={handleMessageUser}
                    className="py-1.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={14} />
                    Message
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Stats Rail: Videos, Followers, Following, (likes) - NO outer border, with SVG icons */}
          <div className="grid grid-cols-4 gap-2 bg-white/[0.02] py-2 px-1 rounded-2xl">
            {/* Videos */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                <Film size={14} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Videos</span>
              </div>
              <span className="text-sm font-extrabold text-white">
                {posts.length}
              </span>
            </div>

            {/* Followers */}
            <div
              onClick={openFollowersList}
              className="flex flex-col items-center justify-center py-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                <UserPlus size={14} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Followers</span>
              </div>
              <span className="text-sm font-extrabold text-white">
                {user.followersCount?.toLocaleString() || 0}
              </span>
            </div>

            {/* Following */}
            <div
              onClick={openFollowingList}
              className="flex flex-col items-center justify-center py-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                <Users size={14} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Following</span>
              </div>
              <span className="text-sm font-extrabold text-white">
                {user.followingCount?.toLocaleString() || 0}
              </span>
            </div>

            {/* (likes) as requested */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center gap-1 text-rose-400 mb-0.5">
                <Heart size={14} className="fill-rose-400" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">(likes)</span>
              </div>
              <span className="text-sm font-extrabold text-white">
                {totalLikes.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Real Analytics Overview: Views, Comments, Shares, Reposts, Saves */}
          <div className="bg-white/[0.03] p-3 rounded-2xl flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-1">
              <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/[0.02]">
                <Eye size={13} className="text-cyan-400 mb-1" />
                <span className="text-xs font-bold text-white">{totalViews.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400">Views</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/[0.02]">
                <MessageCircle size={13} className="text-blue-400 mb-1" />
                <span className="text-xs font-bold text-white">{totalComments.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400">Comments</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/[0.02]">
                <Send size={13} className="text-emerald-400 mb-1" />
                <span className="text-xs font-bold text-white">{totalShares.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400">Shares</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/[0.02]">
                <Repeat2 size={13} className="text-purple-400 mb-1" />
                <span className="text-xs font-bold text-white">{totalReposts.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400">Reposts</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/[0.02]">
                <Bookmark size={13} className="text-amber-400 mb-1" />
                <span className="text-xs font-bold text-white">{totalSaves.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400">Saves</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Videos, Saved, Liked */}
        <div className="flex items-center border-b border-white/[0.06] bg-[#07080c] sticky top-0 z-20">
          <button
            onClick={() => setActiveTab('created')}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors relative",
              activeTab === 'created' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Grid3X3 size={15} />
            <span>Videos</span>
            {activeTab === 'created' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>

          {isMe && (
            <button
              onClick={() => setActiveTab('saved')}
              className={cn(
                "flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors relative",
                activeTab === 'saved' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Bookmark size={15} />
              <span>Saved</span>
              {activeTab === 'saved' && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('liked')}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors relative",
              activeTab === 'liked' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Heart size={15} />
            <span>Liked</span>
            {activeTab === 'liked' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>
        </div>

        {/* Video Grid Feed */}
        <div className="p-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
              Loading videos...
            </div>
          ) : (activeItems.length > 0 || (isMe && activeTab === 'created' && activeUploads.length > 0)) ? (
            <div className="grid grid-cols-3 gap-1">
              {/* Active Background Uploading Items (iOS app install progress animation) */}
              {isMe && activeTab === 'created' && activeUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden relative border border-cyan-500/30 flex flex-col items-center justify-center select-none group shadow-lg"
                >
                  {upload.previewUrl ? (
                    <img
                      src={upload.previewUrl}
                      alt="Uploading preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-35 blur-[1.5px]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-950/90" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/70" />

                  {/* iOS Install Circular Ring */}
                  <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
                    <div className="relative w-12 h-12 flex items-center justify-center mb-1.5">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle
                          cx="24"
                          cy="24"
                          r="19"
                          className="stroke-white/20 fill-black/60"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="19"
                          className="stroke-cyan-400 fill-transparent transition-all duration-300 ease-out"
                          strokeWidth="3.5"
                          strokeDasharray={2 * Math.PI * 19}
                          strokeDashoffset={2 * Math.PI * 19 - (Math.max(upload.progress, 5) / 100) * (2 * Math.PI * 19)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {upload.status === 'completed' ? (
                          <Check size={16} className="text-cyan-400" />
                        ) : upload.status === 'error' ? (
                          <X size={16} className="text-rose-400" />
                        ) : (
                          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-xs animate-pulse" />
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-extrabold text-white tracking-wide">
                      {upload.status === 'completed'
                        ? '100%'
                        : upload.status === 'error'
                        ? 'Failed'
                        : `${upload.progress}%`}
                    </span>
                    <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider mt-0.5">
                      {upload.status === 'completed' ? 'Published' : 'Uploading...'}
                    </span>
                  </div>
                </div>
              ))}

              {/* Published Video Grid Items */}
              {activeItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/post/${item.id}`, { state: { postsList: activeItems, initialIndex: index } })}
                  className="aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden relative group cursor-pointer border border-white/5 hover:border-cyan-400/30 transition-all"
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.caption || 'Video thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  ) : item.type === 'video' ? (
                    <video
                      src={item.content}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.content}
                      alt={item.caption || 'Post image'}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Pinned Badge & Pin Button */}
                  {item.isPinned && (
                    <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full bg-cyan-400 text-black font-extrabold text-[9px] tracking-wide flex items-center gap-1 shadow-md">
                      📌 Pinned
                    </div>
                  )}

                  {isMe && activeTab === 'created' && (
                    <button
                      onClick={(e) => handleTogglePin(e, item.id, item.isPinned)}
                      className={cn(
                        "absolute top-1.5 right-1.5 z-20 p-1.5 rounded-full transition-all shadow-md",
                        item.isPinned
                          ? "bg-cyan-400 text-black scale-100"
                          : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80"
                      )}
                      title={item.isPinned ? "Unpin video card" : "Pin video card to profile"}
                    >
                      <Pin size={12} className={item.isPinned ? "fill-black" : ""} />
                    </button>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <div className="flex items-center justify-between text-[11px] text-white">
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
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3 text-slate-400">
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

      {/* Account Switcher Modal */}
      {isAccountSwitcherOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm rounded-3xl bg-[#0e111a] border border-white/[0.08] p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div>
                <h3 className="font-bold text-white text-base">Switch Account</h3>
                <p className="text-xs text-slate-400">Manage accounts saved on this device</p>
              </div>
              <button
                onClick={() => setIsAccountSwitcherOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/[0.08]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto hide-scrollbar">
              {savedAccounts.map((acc) => {
                const isActive = acc.id === currentUser?.id || acc.uid === currentUser?.uid;
                return (
                  <div
                    key={acc.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer",
                      isActive
                        ? "bg-cyan-500/10 border border-cyan-400/40"
                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                    )}
                    onClick={() => {
                      if (!isActive) {
                        switchAccount(acc);
                      }
                      setIsAccountSwitcherOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.avatar}
                        alt={acc.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white truncate">{acc.displayName}</span>
                          {isActive && <ShieldCheck size={14} className="text-cyan-400 shrink-0" />}
                        </div>
                        <span className="text-xs text-slate-400 truncate">@{acc.username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="text-[11px] font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedAccount(acc.id);
                          }}
                          className="p-2 text-slate-500 hover:text-rose-400 rounded-full hover:bg-rose-500/10"
                          title="Remove from device"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                setIsAccountSwitcherOpen(false);
                requireAuth('Add Account', 'Sign in to add an additional account.', () => {});
              }}
              className="w-full py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} className="text-cyan-400" />
              <span>Add Another Account</span>
            </button>
          </div>
        </div>
      )}

      {/* Followers / Following List Modal */}
      {userListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0f1118] border border-white/[0.08] p-4 shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
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
                userListModal.users.map((u) => {
                  const isSelf = currentUser?.id === u.id || currentUser?.uid === u.id;
                  const isFollowingUser = currentUser?.following?.includes(u.id) || u.isFollowedByMe || (userListModal.title === 'Following' && isMe);
                  const isFriend = u.isFriend || (isFollowingUser && u.isFollowedBy);

                  const handleModalFollowToggle = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!currentUser) {
                      requireAuth('Follow', 'Sign in to follow creators.', () => {});
                      return;
                    }
                    try {
                      const token = await auth.currentUser?.getIdToken();
                      const res = await fetch(`/api/follow/${u.id}`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const nextFollowing = Boolean(data.followed ?? data.isFollowing);
                        
                        // Update currentUser context
                        const currentFollowing = currentUser.following || [];
                        const updatedFollowing = nextFollowing
                          ? [...new Set([...currentFollowing, u.id])]
                          : currentFollowing.filter(fid => fid !== u.id);
                        updateCurrentUser({ following: updatedFollowing });

                        // Update local modal list
                        setUserListModal((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            users: prev.users.map((item) =>
                              item.id === u.id
                                ? { ...item, isFollowedByMe: nextFollowing, isFriend: nextFollowing && (item.isFollowedBy || item.isFriend) }
                                : item
                            )
                          };
                        });
                      }
                    } catch (err) {}
                  };

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <div
                        onClick={() => {
                          setUserListModal(null);
                          const targetId = u.id || u.username;
                          if (targetId) {
                            navigate(`/profile/${targetId}`);
                          }
                        }}
                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 group"
                      >
                        <img
                          src={u.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.id}
                          alt={u.displayName || u.username}
                          className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-white/10 group-hover:border-cyan-400 transition-colors"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                            {u.displayName || u.username}
                          </div>
                          <div className="text-[11px] text-cyan-400 truncate">
                            @{u.username}
                          </div>
                        </div>
                      </div>

                      {!isSelf && (
                        <div>
                          {isFriend ? (
                            <button
                              onClick={handleModalFollowToggle}
                              title="Click to unfollow"
                              className="px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 transition-all flex items-center gap-1.5 shrink-0 ml-2 shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                            >
                              <UserCheck size={13} className="shrink-0 text-cyan-400" />
                              <span>Friends</span>
                            </button>
                          ) : isFollowingUser ? (
                            <button
                              onClick={handleModalFollowToggle}
                              className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/[0.08] hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 transition-all shrink-0 ml-2"
                            >
                              Following
                            </button>
                          ) : (
                            <button
                              onClick={handleModalFollowToggle}
                              className="px-3.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 ml-2 bg-cyan-400 text-black hover:bg-cyan-300 active:scale-95 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                            >
                              {userListModal.title === 'Followers' ? 'Follow Back' : 'Follow'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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
  onUpdated,
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName, username, bio, avatar }),
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
      <header className="pt-safe px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
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
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
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
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50"
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
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50"
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
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400/50 resize-none"
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
