import React, { useState } from 'react';
import { Messages } from './Messages';
import { Notifications } from './Notifications';

export function Inbox() {
  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications');

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="px-4 py-4 border-b border-zinc-900 flex justify-between items-center bg-black/90 backdrop-blur-md z-30 sticky top-0">
        <h1 className="text-xl font-bold text-white tracking-tight">Inbox</h1>
        
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button 
            onClick={() => setTab('notifications')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${tab === 'notifications' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Activity
          </button>
          <button 
            onClick={() => setTab('messages')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${tab === 'messages' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Messages
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden relative">
        {tab === 'notifications' ? <Notifications hideHeader /> : <Messages hideHeader />}
      </div>
    </div>
  );
}
