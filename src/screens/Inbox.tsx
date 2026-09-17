import React from 'react';
import { Activity, MessageCircleMore } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Messages } from './Messages';
import { Notifications } from './Notifications';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

export function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, requireAuth } = useAppContext();
  const tab = location.pathname.endsWith('/messages') ? 'messages' : 'activity';

  if (!currentUser) {
    return <div className="grid h-full place-items-center bg-[#0b0b0a] px-6 text-center text-[#f7f5f0]">
      <div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#ff6b4a]/10 text-[#ff6b4a]"><MessageCircleMore size={28}/></span><h1 className="mt-4 text-xl font-bold">Your conversations and activity</h1><p className="mt-2 text-sm leading-6 text-[#b7b2a8]">Sign in to see messages, requests, mentions, follows and reactions.</p><button onClick={() => requireAuth('Inbox', 'Sign in to access your activity and messages.', () => navigate('/inbox/activity', { replace: true }))} className="mt-6 min-h-12 rounded-xl bg-[#ff6b4a] px-5 font-bold text-[#0b0b0a]">Sign in</button></div>
    </div>;
  }

  return <div className="flex h-full flex-col bg-[#0b0b0a] text-[#f7f5f0]">
    <header className="shrink-0 border-b border-white/10 bg-[#0b0b0a]/95 px-4 pb-3 pt-safe backdrop-blur-xl"><div className="flex h-12 items-center"><h1 className="text-lg font-bold">Inbox</h1></div><nav aria-label="Inbox sections" className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
      <button onClick={() => navigate('/inbox/activity')} aria-current={tab === 'activity' ? 'page' : undefined} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold', tab === 'activity' ? 'bg-[#f7f5f0] text-[#0b0b0a]' : 'text-[#b7b2a8] hover:bg-white/5')}><Activity size={17}/>Activity</button>
      <button onClick={() => navigate('/inbox/messages')} aria-current={tab === 'messages' ? 'page' : undefined} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold', tab === 'messages' ? 'bg-[#f7f5f0] text-[#0b0b0a]' : 'text-[#b7b2a8] hover:bg-white/5')}><MessageCircleMore size={17}/>Messages</button>
    </nav></header>
    <div className="relative min-h-0 flex-1 overflow-hidden">{tab === 'messages' ? <Messages hideHeader/> : <Notifications hideHeader/>}</div>
  </div>;
}
