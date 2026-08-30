import React, { useState } from 'react';
import { Search, Edit, CheckCheck, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';

export function Messages() {
  const { requireAuth } = useAppContext();
  const [conversations, setConversations] = useState<any[]>([]);

  const handleNewMessage = () => {
    requireAuth('Messages', 'Sign in to send direct messages.', () => {
      // Create new message logic
    });
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">Messages</h1>
        <button onClick={handleNewMessage} className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
          <Edit size={18} />
        </button>
      </header>
      
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 px-2">
        {conversations.length > 0 ? (
          conversations.map((chat) => (
            <div key={chat.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-900/50 cursor-pointer transition-colors">
              <div className="relative w-14 h-14 shrink-0">
                <img src={chat.participant?.avatar} alt={chat.participant?.displayName} className="w-full h-full rounded-full object-cover bg-zinc-800" />
                {chat.unreadCount > 0 && (
                  <div className="absolute top-0 right-0 w-4 h-4 bg-blue-500 rounded-full border-2 border-black"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white truncate pr-2">{chat.participant?.displayName}</span>
                  <span className="text-xs text-zinc-500 shrink-0">
                    {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: false })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  {chat.unreadCount === 0 && <CheckCheck size={14} className="text-zinc-600 shrink-0" />}
                  <span className={`truncate ${chat.unreadCount > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                    {chat.lastMessage}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center mt-10">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 mb-4">
              <MessageCircle size={32} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">No messages yet</h2>
            <p className="text-zinc-500 text-sm mb-6">When you connect with people, you'll see your conversations here.</p>
            <button 
              onClick={handleNewMessage}
              className="bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-2"
            >
              <Edit size={18} />
              New Message
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
