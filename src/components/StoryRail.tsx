import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';

type Status = { id: string; authorId: string; author?: { id?: string; displayName?: string; username?: string; avatar?: string } };

export function StoryRail() {
  const [statuses, setStatuses] = React.useState<Status[]>([]);
  const navigate = useNavigate();
  const { currentUser, requireAuth } = useAppContext();

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/statuses', { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) return;
        const payload = await response.json();
        setStatuses(Array.isArray(payload) ? payload.filter((item): item is Status => Boolean(item?.id && item?.authorId)) : []);
      } catch (error: any) { if (error?.name !== 'AbortError') console.warn('Statuses unavailable:', error); }
    })();
    return () => controller.abort();
  }, [currentUser?.id]);

  if (!currentUser && statuses.length === 0) return null;
  return <section aria-label="Status stories" className="absolute inset-x-0 top-[72px] z-20 overflow-x-auto px-4 hide-scrollbar"><div className="flex w-max gap-3 rounded-[22px] border border-white/10 bg-black/45 p-2.5 backdrop-blur-xl">
    {currentUser && <button onClick={() => requireAuth('Create', 'Sign in to add a Moment.', () => navigate('/create'))} className="w-14 text-center"><span className="relative mx-auto grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-white/20 bg-[var(--omni-bg-elevated)]">{currentUser.avatar ? <img src={currentUser.avatar} alt="" className="h-full w-full object-cover"/> : currentUser.displayName?.slice(0,1)}<span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-omni-accent text-[#0b0b0a]"><Plus size={12}/></span></span><span className="mt-1 block truncate text-[10px] text-white">Add</span></button>}
    {statuses.slice(0, 12).map(status => { const name = status.author?.displayName || status.author?.username || 'Creator'; return <button key={status.id} onClick={() => navigate(`/post/${status.id}`)} className="w-14 text-center"><span className="mx-auto block h-11 w-11 rounded-full bg-gradient-to-br from-omni-accent to-[var(--omni-secondary)] p-[2px]"><span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-black bg-[var(--omni-bg-elevated)]">{status.author?.avatar ? <img src={status.author.avatar} alt="" className="h-full w-full object-cover"/> : name.slice(0,1)}</span></span><span className="mt-1 block truncate text-[10px] text-white">{name}</span></button>; })}
  </div></section>;
}
