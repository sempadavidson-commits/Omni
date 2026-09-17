import React from 'react';
import { Activity, MessageCircleMore, PenLine } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Messages } from './Messages';
import { Notifications } from './Notifications';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';

export function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, requireAuth, unreadInboxCount } = useAppContext();
  const tab = location.pathname.endsWith('/messages') ? 'messages' : 'activity';

  if (!currentUser) return <div className="grid h-full place-items-center bg-omni-bg px-6 text-center"><div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--omni-accent-soft)] text-omni-accent"><MessageCircleMore size={28}/></span><h1 className="mt-5 text-2xl font-semibold tracking-tight">Your people are here</h1><p className="mt-2 text-sm leading-6 text-[var(--omni-text-secondary)]">Sign in to see conversations, mentions, follows and reactions.</p><Button className="mt-6" onClick={() => requireAuth('Inbox', 'Sign in to access your activity and messages.', () => navigate('/inbox/activity', { replace: true }))}>Sign in</Button></div></div>;

  return <div className="flex h-full flex-col bg-omni-bg text-[var(--omni-text-primary)]">
    <header className="shrink-0 border-b border-[var(--omni-border-subtle)] bg-[rgba(11,11,10,.94)] px-4 pb-3 pt-safe backdrop-blur-xl">
      <div className="flex h-12 items-center justify-between"><div><h1 className="text-xl font-semibold tracking-tight">Inbox</h1><p className="text-xs text-[var(--omni-text-muted)]">Activity and conversations</p></div><button type="button" onClick={() => navigate('/search')} aria-label="Start a conversation" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.08]"><PenLine size={20}/></button></div>
      <nav aria-label="Inbox sections" className="mt-2 grid grid-cols-2 rounded-2xl bg-white/[0.05] p-1">
        <button onClick={() => navigate('/inbox/activity')} aria-current={tab === 'activity' ? 'page' : undefined} className={cn('relative flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition', tab === 'activity' ? 'bg-[var(--omni-bg-elevated)] text-white shadow-sm' : 'text-[var(--omni-text-secondary)]')}><Activity size={17}/>Activity{tab !== 'activity' && unreadInboxCount > 0 && <span className="h-2 w-2 rounded-full bg-omni-accent"/>}</button>
        <button onClick={() => navigate('/inbox/messages')} aria-current={tab === 'messages' ? 'page' : undefined} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition', tab === 'messages' ? 'bg-[var(--omni-bg-elevated)] text-white shadow-sm' : 'text-[var(--omni-text-secondary)]')}><MessageCircleMore size={17}/>Messages</button>
      </nav>
    </header>
    <div className="relative min-h-0 flex-1 overflow-hidden">{tab === 'messages' ? <Messages hideHeader/> : <Notifications hideHeader/>}</div>
  </div>;
}
