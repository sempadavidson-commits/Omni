import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Messages } from './Messages';
import { Notifications } from './Notifications';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

export function Inbox() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialTab = (searchParams.get('tab') === 'messages' || location.pathname.includes('/messages')) ? 'messages' : 'notifications';
  const [tab, setTab] = useState<'notifications' | 'messages'>(initialTab);
  const { currentUser, requireAuth } = useAppContext();

  useEffect(() => {
    if (searchParams.get('tab') === 'messages' || location.pathname.includes('/messages')) {
      setTab('messages');
    }
  }, [searchParams, location.pathname]);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#07080c] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10  flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Sign In to View Inbox</h2>
        <p className="text-xs text-slate-400 max-w-xs mb-6">
          Access your direct messages, comments, likes, and creator activity on Omni.
        </p>
        <button
          onClick={() => requireAuth('Inbox', 'Sign in to access your activity and messages.', () => {})}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)]"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white">
      {/* Top Header with Segmented Navigation */}
      <header className="pt-safe px-4 py-3 border-b  flex items-center justify-between bg-[#07080c]/90  shrink-0 z-30">
        <h1 className="text-lg font-black tracking-wider text-white">INBOX</h1>

        <div className="flex bg-white/[0.05] p-1 rounded-xl ">
          <button
            onClick={() => setTab('notifications')}
            className={cn(
              "px-3.5 py-1 text-xs font-bold rounded-lg transition-all",
              tab === 'notifications'
                ? "bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                : "text-slate-400 hover:text-white"
            )}
          >
            Activity
          </button>
          <button
            onClick={() => setTab('messages')}
            className={cn(
              "px-3.5 py-1 text-xs font-bold rounded-lg transition-all relative",
              tab === 'messages'
                ? "bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                : "text-slate-400 hover:text-white"
            )}
          >
            Messages
          </button>
        </div>
      </header>

      {/* Tab Viewport */}
      <div className="flex-1 overflow-hidden relative">
        {tab === 'notifications' ? <Notifications hideHeader /> : <Messages hideHeader />}
      </div>
    </div>
  );
}
