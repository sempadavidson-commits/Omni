import React from 'react';
import { Bell, Heart, MessageCircle, Repeat2, Share2, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { ScreenState } from '../components/ui/ScreenState';

interface ActivityItem { id: string | number; type: string; targetId?: string; message?: string; isRead?: boolean; createdAt?: string; actor?: { id?: string; displayName?: string; username?: string; avatar?: string } }

const iconFor = (type: string) => ({ LIKE: Heart, FOLLOW: UserPlus, COMMENT: MessageCircle, MESSAGE: MessageCircle, REPOST: Repeat2, SHARE: Share2 }[type] || Bell);
const copyFor = (item: ActivityItem) => item.message || ({ LIKE: 'liked your post', FOLLOW: 'started following you', COMMENT: 'commented on your post', MESSAGE: 'sent you a message', REPOST: 'reposted your post', SHARE: 'shared your post' }[item.type] || 'interacted with your profile');

export function Notifications({ hideHeader }: { hideHeader?: boolean } = {}) {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const { currentUser, refreshUnreadCount } = useAppContext();
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    if (!currentUser || !auth.currentUser) { setItems([]); setState('ready'); return; }
    setState('loading');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Activity request failed (${response.status})`);
      const payload = await response.json();
      setItems((Array.isArray(payload) ? payload : []).map((value: any) => value?.notification ? { ...value.notification, actor: value.actor || value.notification.actor } : value).filter(Boolean));
      setState('ready');
      const readResponse = await fetch('/api/notifications/read', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (readResponse.ok) refreshUnreadCount();
    } catch (error) {
      console.error('Failed to load activity:', error);
      setState('error');
    }
  }, [currentUser]);

  React.useEffect(() => { void load(); }, [load]);

  const openItem = (item: ActivityItem) => {
    if (item.type === 'MESSAGE' && item.actor?.id) navigate(`/messages?user=${encodeURIComponent(item.actor.id)}`);
    else if (item.targetId) navigate(`/post/${item.targetId}`);
    else if (item.actor?.id) navigate(`/profile/${item.actor.id}`);
  };

  return <div className="flex h-full flex-col bg-omni-bg">
    {!hideHeader && <header className="border-b border-[var(--omni-border-subtle)] px-4 py-4"><h1 className="text-xl font-semibold">Activity</h1></header>}
    <main className="flex-1 overflow-y-auto pb-24">
      {state === 'loading' && <ScreenState kind="loading" title="Loading activity" description="Getting the latest moments from your community."/>}
      {state === 'error' && <ScreenState kind="error" title="Activity could not load" description="Check your connection and try again." actionLabel="Try again" onAction={load}/>} 
      {state === 'ready' && items.length === 0 && <ScreenState kind="empty" title="Nothing new yet" description="Follows, replies and reactions will appear here."/>}
      {state === 'ready' && items.length > 0 && <section aria-label="Recent activity"><h2 className="px-4 pb-2 pt-5 text-xs font-semibold uppercase tracking-wider text-[var(--omni-text-muted)]">New and recent</h2>{items.map((item, index) => {
        const Icon = iconFor(item.type); const actorName = item.actor?.displayName || item.actor?.username || 'Someone';
        return <button key={item.id ?? index} onClick={() => openItem(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--omni-bg-elevated)]">{item.actor?.avatar ? <img src={item.actor.avatar} alt="" className="h-full w-full object-cover"/> : <span className="text-sm font-bold text-omni-accent">{actorName.slice(0,1).toUpperCase()}</span>}<span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--omni-bg-base)] bg-omni-accent text-[#0b0b0a]"><Icon size={10}/></span></span>
          <span className="min-w-0 flex-1"><span className="text-sm leading-5"><b>{actorName}</b> <span className="text-[var(--omni-text-secondary)]">{copyFor(item)}</span></span><span className="mt-1 block text-xs text-[var(--omni-text-muted)]">{item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : 'Just now'}</span></span>{!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-omni-accent"/>}</button>;
      })}</section>}
    </main>
  </div>;
}
