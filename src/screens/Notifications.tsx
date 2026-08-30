import React, { useState } from 'react';
import { Heart, UserPlus, MessageCircle, AtSign, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { AppNotification } from '../types';

export function Notifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-rose-500 fill-rose-500" />;
      case 'follow': return <UserPlus size={16} className="text-blue-500" />;
      case 'comment': return <MessageCircle size={16} className="text-emerald-500 fill-emerald-500" />;
      case 'mention': return <AtSign size={16} className="text-purple-500" />;
      default: return null;
    }
  };

  const getText = (type: string, name: string) => {
    switch (type) {
      case 'like': return <><span className="font-semibold text-white">{name}</span> liked your post.</>;
      case 'follow': return <><span className="font-semibold text-white">{name}</span> started following you.</>;
      case 'comment': return <><span className="font-semibold text-white">{name}</span> commented on your post.</>;
      case 'mention': return <><span className="font-semibold text-white">{name}</span> mentioned you.</>;
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {notifications.length > 0 ? (
          notifications.map((notif: any) => {
            const actor = notif.actor;
            const post = notif.post;
            if (!actor) return null;

            return (
              <div key={notif.id} className={cn(
                "flex items-start gap-4 p-4 border-b border-zinc-900/50 transition-colors hover:bg-zinc-900/30 cursor-pointer",
                !notif.read && "bg-blue-500/5 hover:bg-blue-500/10"
              )}>
                <div className="relative pt-1 shrink-0">
                  <div className="absolute -top-1 -right-1 z-10 bg-black p-0.5 rounded-full">
                    {getIcon(notif.type)}
                  </div>
                  <img src={actor.avatar} alt={actor.displayName} className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 leading-snug mb-1">
                    {getText(notif.type, actor.displayName)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {post?.type === 'image' && post.content && (
                  <div className="shrink-0 w-12 h-12 rounded bg-zinc-800 overflow-hidden">
                    <img src={post.content} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
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
