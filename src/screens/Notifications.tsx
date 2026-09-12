import React, { useState, useEffect } from 'react';
import { Heart, UserPlus, MessageCircle, AtSign, Bell, Repeat2, Share, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';

export function Notifications({ hideHeader }: { hideHeader?: boolean } = {}) {
  const [notifications, setNotifications] = useState([]);
  const { currentUser } = useAppContext();

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchNotifs = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
          // Mark as read
          fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchNotifs();
  }, [currentUser]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart size={16} className="text-rose-500 fill-rose-500" />;
      case 'FOLLOW': return <UserPlus size={16} className="text-blue-500" />;
      case 'COMMENT': return <MessageCircle size={16} className="text-emerald-500 fill-emerald-500" />;
      case 'REPOST': return <Repeat2 size={16} className="text-emerald-500" />;
      case 'SHARE': return <Share size={16} className="text-zinc-500" />;
      case 'SYSTEM': return <Info size={16} className="text-blue-500" />;
      default: return null;
    }
  };

  const getText = (type: string, actor: any, n: any) => {
    if (type === 'SYSTEM') return <><span className="font-semibold text-white">System:</span> {n.message}</>;
    if (!actor) return <><span className="font-semibold text-white">Someone</span> interacted with you.</>;
    
    switch (type) {
      case 'LIKE': return <><span className="font-semibold text-white">{actor.displayName}</span> liked your post.</>;
      case 'FOLLOW': return <><span className="font-semibold text-white">{actor.displayName}</span> started following you.</>;
      case 'COMMENT': return <><span className="font-semibold text-white">{actor.displayName}</span> commented on your post.</>;
      case 'REPOST': return <><span className="font-semibold text-white">{actor.displayName}</span> reposted your post.</>;
      case 'SHARE': return <><span className="font-semibold text-white">{actor.displayName}</span> shared your post.</>;
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {!hideHeader && (
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
          <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {notifications.length > 0 ? (
          notifications.map((item: any) => {
            const notif = item.notification;
            const actor = item.actor;
            return (
              <div key={notif.id} className={cn(
                "flex items-start gap-4 p-4 border-b border-zinc-900/50 transition-colors hover:bg-zinc-900/30 cursor-pointer",
                !notif.isRead && "bg-blue-500/5 hover:bg-blue-500/10"
              )}>
                <div className="relative pt-1 shrink-0">
                  <div className="absolute -top-1 -right-1 z-10 bg-black p-0.5 rounded-full">
                    {getIcon(notif.type)}
                  </div>
                  {actor ? (
                    <img src={actor.avatar} alt={actor.displayName} className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                      <Bell size={20} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 leading-snug mb-1">
                    {getText(notif.type, actor, notif)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center mt-10">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 mb-4">
              <Bell size={32} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">No notifications</h2>
            <p className="text-zinc-500 text-sm mb-6">You're all caught up! Interactions with your posts will appear here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
