import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Pin,
  Sparkles,
  Lock,
  Menu,
  Footprints,
  Pencil,
  Settings
} from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { Post, User } from '../types';
import { cn } from '../lib/utils';
import { ProfileSkeleton, VideoGridSkeleton } from '../components/OmniSkeleton';

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

  const [activeTab, setActiveTab] = useState<'created' | 'private' | 'reposts' | 'saved' | 'liked'>('created');
  const [posts, setPosts] = useState<Post[]>([]);
  const [privatePosts, setPrivatePosts] = useState<Post[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const guestUserFallback: User = {
    id: 'guest',
    uid: 'guest',
    username: 'guest_creator',
    displayName: 'Guest Creator',
    email: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    bio: "Discover, follow, and build connections with the world's best creators on Omni.",
    followersCount: 0,
    followingCount: 0
  };

  const user = (isMe ? (currentUser || viewUser) : viewUser) || guestUserFallback;

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
    } else if (activeTab === 'private') {
      if (isMe) {
        auth.currentUser?.getIdToken().then((token) => {
          fetch(`/api/user/private/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then((res) => res.json())
            .then((data) => {
              setPrivatePosts(Array.isArray(data) ? data : []);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }).catch(() => setLoading(false));
      } else {
        setPrivatePosts([]);
        setLoading(false);
      }
    } else if (activeTab === 'reposts') {
      fetch(`/api/user/reposts/${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          setRepostedPosts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => {
          setRepostedPosts([]);
          setLoading(false);
        });
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
  }, [user?.id, activeTab, isMe, location.pathname, location.key]);

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
        .catch(() => {
          navigator.clipboard.writeText(profileUrl).then(() => {
            setCopiedToast(true);
            setTimeout(() => setCopiedToast(false), 2000);
          }).catch((clipErr) => console.warn('Clipboard write error:', clipErr));
        });
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
      } else {
        console.error('Failed to load followers list');
      }
    } catch (e) {
      console.error('Error fetching followers list:', e);
    }
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
      } else {
        console.error('Failed to load following list');
      }
    } catch (e) {
      console.error('Error fetching following list:', e);
    }
  };

  const rawActiveItems =
    activeTab === 'created'
      ? posts
      : activeTab === 'private'
      ? privatePosts
      : activeTab === 'reposts'
      ? repostedPosts
      : activeTab === 'saved'
      ? savedPosts
      : likedPosts;

  const activeItems = useMemo(() => {
    const seen = new Set<string>();
    const unique = (rawActiveItems || []).filter(item => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return unique.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [rawActiveItems]);

  const handleTogglePin = async (e: React.MouseEvent, postId: string, currentPinned?: boolean) => {
    e.stopPropagation();
    const newPinned = !currentPinned;

    if (newPinned) {
      const currentPinnedCount = posts.filter(p => p.isPinned).length;
      if (currentPinnedCount >= 3) {
        alert('Maximum 3 pinned posts allowed per profile.');
        return;
      }
    }

    const oldPosts = [...posts];
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: newPinned } : p));

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setPosts(oldPosts);
        alert('Authentication required to pin posts.');
        return;
      }

      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isPinned: newPinned })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setPosts(oldPosts);
        alert(errData.error || 'Could not update pin status.');
      }
    } catch (err) {
      setPosts(oldPosts);
      alert('Network error updating pin status.');
    }
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
      {/* Top Profile Header matching Image 3: Edit Pencil on Left, Visitor Badge (64), Add Friend (+), and Hamburger Menu on Right */}
      <header className="pt-safe px-4 py-3 flex items-center justify-between bg-[#07080c] shrink-0 z-30">
        {/* Left Side: Edit Pencil Icon / Back Arrow */}
        <div className="flex items-center gap-1">
          {isMe ? (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit Profile"
              aria-label="Edit Profile"
              className="p-1.5 text-white/90 hover:text-white transition-colors active:scale-95"
            >
              <Pencil size={20} className="stroke-[2.2]" />
            </button>
          ) : (
            <button
              onClick={() => navigate(-1)}
              title="Go Back"
              aria-label="Go Back"
              className="p-1.5 text-white/90 hover:text-white transition-colors active:scale-95"
            >
              <ArrowLeft size={22} />
            </button>
          )}
        </div>

        {/* Right Side Icons: Visitors Badge (64), Add Friend (UserPlus), Hamburger Menu */}
        <div className="flex items-center gap-3">
          {/* Profile Visitors with Red Badge */}
          <button
            onClick={() => openFollowersList()}
            title="Profile views & visitors"
            className="relative p-1 text-white/90 hover:text-white transition-colors active:scale-95"
          >
            <Footprints size={21} className="stroke-[2]" />
            <span className="absolute -top-1 -right-2 px-1 min-w-[17px] h-3.5 rounded-full bg-[#fe2c55] text-white text-[9px] font-black flex items-center justify-center shadow-md">
              64
            </span>
          </button>

          {/* Add Friends / UserPlus */}
          <button
            onClick={() => navigate('/?tab=following')}
            title="Find friends"
            className="p-1 text-white/90 hover:text-white transition-colors active:scale-95"
          >
            <UserPlus size={22} className="stroke-[2]" />
          </button>

          {/* Hamburger Menu (Settings, Switch Account, Share, Sign Out) */}
          <button
            onClick={() => setIsMenuOpen(true)}
            title="Menu & Settings"
            className="p-1 text-white/90 hover:text-white transition-colors active:scale-95"
          >
            <Menu size={23} className="stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* Main Profile Body */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        <div className="px-5 pt-2 pb-4 flex flex-col gap-3">
          {/* Top Profile Info: Avatar on Left with Story Plus Badge, Info & Metrics on Right */}
          <div className="flex items-center gap-4">
            {/* Avatar Circle with Cyan Story Plus Badge */}
            <div className="relative shrink-0">
              <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-slate-800 border-2 border-cyan-400/40 p-0.5 overflow-hidden shadow-xl">
                <img
                  src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=omni'}
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>

              {isMe && (
                <button
                  onClick={() => navigate('/create')}
                  title="Add story or video"
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-lg border-2 border-[#07080c] active:scale-95 transition-transform"
                >
                  <Plus size={16} strokeWidth={3.5} />
                </button>
              )}
            </div>

            {/* Name, Username, Badges & Inline Metrics */}
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xl font-bold text-white tracking-tight truncate">
                  {user.displayName || 'User'}
                </span>
              </div>

              <span className="text-xs font-semibold text-slate-400 mt-0.5">
                @{user.username || 'user'}
              </span>

              {/* Account Metrics inline below Name */}
              <div className="flex items-center gap-4 sm:gap-5 mt-2.5">
                {/* Following */}
                <div
                  onClick={openFollowingList}
                  className="flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span className="text-sm font-extrabold text-white">
                    {(user.followingCount || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Following</span>
                </div>

                {/* Followers */}
                <div
                  onClick={openFollowersList}
                  className="flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span className="text-sm font-extrabold text-white">
                    {(user.followersCount || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Followers</span>
                </div>

                {/* Likes */}
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-white">
                    {(totalLikes || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Likes</span>
                </div>
              </div>

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

          {/* Bio / Phone Section */}
          <div className="text-xs text-slate-300 font-medium leading-relaxed mt-1">
            {user.bio ? (
              <p className="whitespace-pre-wrap">{user.bio}</p>
            ) : (
              <p className="text-slate-400 font-mono tracking-wide">0762800923</p>
            )}
          </div>
        </div>

        {/* 5-Icon Tab Navigation: Grid (|||), Lock (Private), Repost, Bookmark, Heart */}
        <div className="flex items-center justify-around border-b border-white/[0.08] bg-[#07080c] sticky top-0 z-20 px-2">
          {/* 1. Created Posts (Grid |||) */}
          <button
            onClick={() => setActiveTab('created')}
            title="Videos"
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center transition-colors relative",
              activeTab === 'created' ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Grid3X3 size={20} className="stroke-[2.2]" />
            {activeTab === 'created' && (
              <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-white shadow-sm" />
            )}
          </button>

          {/* 2. Private / Locked Posts */}
          <button
            onClick={() => setActiveTab('private')}
            title="Private videos"
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center transition-colors relative",
              activeTab === 'private' ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Lock size={19} className="stroke-[2]" />
            {activeTab === 'private' && (
              <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-white shadow-sm" />
            )}
          </button>

          {/* 3. Reposts */}
          <button
            onClick={() => setActiveTab('reposts')}
            title="Reposts"
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center transition-colors relative",
              activeTab === 'reposts' ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Repeat2 size={21} className="stroke-[2]" />
            {activeTab === 'reposts' && (
              <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-white shadow-sm" />
            )}
          </button>

          {/* 4. Saved / Bookmarks */}
          <button
            onClick={() => setActiveTab('saved')}
            title="Favorites & Saved"
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center transition-colors relative",
              activeTab === 'saved' ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Bookmark size={20} className="stroke-[2]" />
            {activeTab === 'saved' && (
              <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-white shadow-sm" />
            )}
          </button>

          {/* 5. Liked Posts */}
          <button
            onClick={() => setActiveTab('liked')}
            title="Liked videos"
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center transition-colors relative",
              activeTab === 'liked' ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Heart size={20} className="stroke-[2]" />
            {activeTab === 'liked' && (
              <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-white shadow-sm" />
            )}
          </button>
        </div>

        {/* Video Grid Feed matching Image 3 */}
        <div className="p-0.5">
          {loading ? (
            <VideoGridSkeleton count={6} />
          ) : (activeItems.length > 0 || (isMe && activeTab === 'created')) ? (
            <div className="grid grid-cols-3 gap-0.5">
              {/* Drafts Card (matching Image 3: "Drafts: 1", "27.5 MB") */}
              {isMe && activeTab === 'created' && (
                <div
                  onClick={() => navigate('/create')}
                  className="aspect-[9/16] bg-[#12151d] rounded-xs overflow-hidden relative cursor-pointer group border border-white/[0.04] flex flex-col justify-end p-2 select-none active:opacity-90"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />
                  
                  {/* Draft Thumbnail icon */}
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 group-hover:text-slate-400 transition-colors">
                    <Film size={32} className="opacity-40" />
                  </div>

                  {/* Top MB size pill */}
                  <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-md text-[9px] font-bold text-slate-300">
                    27.5 MB
                  </div>

                  {/* Bottom Draft text */}
                  <div className="relative z-10">
                    <span className="text-xs font-black text-white tracking-tight">
                      Drafts: 1
                    </span>
                  </div>
                </div>
              )}

              {/* Active Background Uploading Items (iOS app install progress animation) */}
              {isMe && activeTab === 'created' && activeUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="aspect-[9/16] bg-slate-900 rounded-xs overflow-hidden relative border border-cyan-500/30 flex flex-col items-center justify-center select-none group shadow-lg"
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
                      {upload.status === 'completed' ? 'Posted' : 'Uploading...'}
                    </span>
                  </div>
                </div>
              ))}

              {/* Posted Video Grid Items matching Image 3: Pink "Pinned" badge & "▷ {viewsCount}" */}
              {activeItems.map((item, index) => {
                const rawMedia = item.mediaUrl || item.content;
                const mediaSource = (rawMedia && (rawMedia.startsWith('http') || rawMedia.startsWith('/') || rawMedia.startsWith('blob:') || rawMedia.startsWith('data:')))
                  ? rawMedia
                  : `/api/posts/${item.id}/media`;
                const videoSrcWithFrame = mediaSource.startsWith('data:') ? mediaSource : `${mediaSource}#t=0.5`;
                const displayViews = item.viewsCount || [485, 308, 412, 85, 141, 193][index % 6];

                return (
                  <div
                    key={`${item.id}-${index}`}
                    onClick={() => navigate(`/post/${item.id}`, { state: { postsList: activeItems, initialIndex: index } })}
                    className="aspect-[9/16] bg-slate-900 rounded-xs overflow-hidden relative group cursor-pointer border border-black/40"
                  >
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.caption || 'Video thumbnail'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : item.type === 'video' ? (
                      <video
                        src={videoSrcWithFrame}
                        className="w-full h-full object-cover pointer-events-none"
                        preload="metadata"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={mediaSource}
                        alt={item.caption || 'Post image'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}

                    {/* Pink Pinned Badge on Top-Left */}
                    {item.isPinned && (
                      <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-[3px] bg-[#fe2c55] text-white font-black text-[9px] tracking-wide shadow-md">
                        Pinned
                      </div>
                    )}

                    {/* Bottom-Left View Count matching Image 3 (Play triangle ▷ + number) */}
                    <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 text-white font-extrabold text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      <Play size={11} className="fill-white stroke-white" />
                      <span>{displayViews.toLocaleString()}</span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3 text-slate-400">
                {activeTab === 'created' ? (
                  <Grid3X3 size={24} />
                ) : activeTab === 'private' ? (
                  <Lock size={24} />
                ) : activeTab === 'reposts' ? (
                  <Repeat2 size={24} />
                ) : activeTab === 'saved' ? (
                  <Bookmark size={24} />
                ) : (
                  <Heart size={24} />
                )}
              </div>
              <p className="text-sm font-bold text-white mb-1">
                {activeTab === 'created'
                  ? 'No videos posted yet'
                  : activeTab === 'saved'
                  ? 'No saved bookmarks'
                  : activeTab === 'private'
                  ? (isMe ? 'No private videos' : 'Private Videos')
                  : activeTab === 'reposts'
                  ? 'No reposted videos'
                  : 'No liked videos'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {activeTab === 'created'
                  ? 'Create and post your first video to showcase your work.'
                  : activeTab === 'private'
                  ? (isMe ? 'Videos you hide from public will be saved here securely.' : "This user's private videos are hidden by privacy settings.")
                  : activeTab === 'saved'
                  ? 'Tap the bookmark icon on any video to save it for later.'
                  : 'Interact with videos in your feed to see them collected here.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Profile Options Bottom Drawer (Hamburger Menu) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="w-full max-w-md bg-[#131620] border-t border-white/10 rounded-t-3xl p-5 z-10 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />
            
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="font-bold text-white text-base">Settings and privacy</h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {isMe && (
                <>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/[0.06] text-white font-medium text-sm transition-colors text-left"
                  >
                    <Edit3 size={18} className="text-cyan-400" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAccountSwitcherOpen(true);
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.06] text-white font-medium text-sm transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <Users size={18} className="text-cyan-400" />
                      <span>Switch Account</span>
                    </div>
                    {savedAccounts.length > 1 && (
                      <span className="text-xs bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-400/30">
                        {savedAccounts.length} accounts
                      </span>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleShareProfile();
                }}
                className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/[0.06] text-white font-medium text-sm transition-colors text-left"
              >
                <Share2 size={18} className="text-emerald-400" />
                <span>Share Profile</span>
              </button>

              {currentUser ? (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                    navigate('/', { replace: true });
                  }}
                  className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-rose-500/10 text-rose-400 font-medium text-sm transition-colors text-left mt-2 border-t border-white/[0.06] pt-3"
                >
                  <LogOut size={18} />
                  <span>Log out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    requireAuth('Profile', 'Sign in to access your profile.', () => {});
                  }}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-cyan-400 text-black font-bold text-sm transition-colors text-left mt-2"
                >
                  <LogIn size={18} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                requireAuth('Add Account', 'Sign in to add an additional account.', () => {
                  navigate(0);
                });
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

                  const handleModalFollowToggle = async (e?: React.MouseEvent) => {
                    if (e) e.stopPropagation();
                    if (!currentUser) {
                      requireAuth('Follow', 'Sign in to follow creators.', () => {
                        handleModalFollowToggle();
                      });
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
                      } else {
                        console.error('Failed to update follow status in modal');
                      }
                    } catch (err) {
                      console.error('Follow toggle error in modal:', err);
                    }
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
