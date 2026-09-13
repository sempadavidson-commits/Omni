import React, { useState, useEffect } from 'react';
import { Heart, UserPlus, MessageCircle, Repeat2, Share2, Bell, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';

export function Notifications({ hideHeader }: { hideHeader?: boolean } = {}) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, refreshUnreadCount } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchNotifs = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(Array.isArray(data) ? data : []);
          // Mark read
          await fetch('/api/notifications/read', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          refreshUnreadCount();
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifs();
  }, [currentUser]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
        return <Heart size={13} className="text-cyan-400 fill-cyan-400" />;
      case 'FOLLOW':
        return <UserPlus size={13} className="text-indigo-400" />;
      case 'COMMENT':
        return <MessageCircle size={13} className="text-emerald-400 fill-emerald-400" />;
      case 'REPOST':
        return <Repeat2 size={13} className="text-emerald-400" />;
      case 'SHARE':
        return <Share2 size={13} className="text-amber-400" />;
      default:
        return <Bell size={13} className="text-cyan-400" />;
    }
  };

  const getActionDescription = (type: string) => {
    switch (type) {
      case 'LIKE': return 'liked your post.';
      case 'FOLLOW': return 'started following you.';
      case 'COMMENT': return 'commented on your video.';
      case 'REPOST': return 'reposted your video.';
      case 'SHARE': return 'shared your video.';
      default: return 'interacted with your profile.';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#07080c]">
      {!hideHeader && (
        <header className="px-4 py-3.5 border-b  flex items-center justify-between bg-[#07080c]/90 ">
          <h2 className="text-lg font-bold text-white">Activity</h2>
        </header>
      )}

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 p-3">
        {loading ? (
          <div className="flex flex-col gap-3 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 rounded bg-white/[0.05]" />
                  <div className="w-20 h-3 rounded bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((item: any, idx: number) => {
            const notif = item?.notification || item;
            if (!notif) return null;
            const actor = notif.actor || item?.actor;
            const isRead = notif.isRead ?? false;
            const targetPostId = notif.targetId || notif.postId;
            const notifId = notif.id ?? item?.id ?? idx;
            const notifType = notif.type || 'SYSTEM';

            return (
              <div
                key={notifId}
                onClick={() => {
                  if (targetPostId) {
                    navigate(`/post/${targetPostId}`);
                  } else if (actor?.id) {
                    navigate(`/profile/${actor.id}`);
                  }
                }}
                className={cn(
                  "flex items-start gap-3.5 p-3 rounded-2xl mb-1.5 transition-colors cursor-pointer border",
                  !isRead
                    ? "bg-cyan-500/[0.06]  hover:bg-cyan-500/[0.1]"
                    : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]"
                )}
              >
                <div className="relative pt-0.5 shrink-0">
                  <img
                    src={actor?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                    alt={actor?.displayName || 'User'}
                    className="w-10 h-10 rounded-full object-cover bg-slate-800 "
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0f1118]  flex items-center justify-center">
                    {getIcon(notifType)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-relaxed">
                    <span className="font-bold text-white">
                      {actor?.displayName || 'Someone'}{' '}
                    </span>
                    {getActionDescription(notifType)}
                  </p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : 'just now'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10  flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
              <Bell size={32} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No notifications yet</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              When others like your videos, leave comments, or follow you, you'll see it here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
