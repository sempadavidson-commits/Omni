import React, { useState, useRef } from 'react';
import { Search, Edit, CheckCheck, MessageCircle, ArrowLeft, Send, Image as ImageIcon, Video, Mic, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

export function Messages({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { requireAuth, currentUser } = useAppContext();
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<any[]>([
    { id: 1, text: 'Hey there! How is it going?', senderId: 'other', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, text: 'Check out this link: https://google.com', senderId: 'me', timestamp: new Date().toISOString() }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!messageText.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: messageText,
      senderId: 'me',
      timestamp: new Date().toISOString()
    }]);
    setMessageText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Sent a ${file.type.startsWith('video') ? 'video' : 'picture'}`,
        mediaUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith('video') ? 'video' : 'image',
        senderId: 'me',
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (activeChat) {
    return (
      <div className="flex flex-col h-full bg-black">
        <header className="px-4 py-3 border-b border-zinc-900 flex items-center gap-3 bg-black/90 backdrop-blur-md z-30">
          <button onClick={() => setActiveChat(null)} className="text-zinc-400 hover:text-white p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src={activeChat.avatar} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-base truncate">{activeChat.displayName}</h2>
              <p className="text-zinc-500 text-xs">Active now</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-20">
          {messages.map((m) => {
            const isMe = m.senderId === 'me';
            return (
              <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5",
                  isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-zinc-900 text-zinc-200 rounded-bl-none"
                )}>
                  {m.mediaUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden max-h-64">
                      {m.mediaType === 'video' ? (
                        <video src={m.mediaUrl} controls className="w-full object-cover" />
                      ) : (
                        <img src={m.mediaUrl} className="w-full object-cover" />
                      )}
                    </div>
                  )}
                  {m.audioUrl && (
                    <audio src={m.audioUrl} controls className="w-full max-w-xs h-10 mb-1" />
                  )}
                  {m.text && <p className="text-[15px] leading-relaxed break-words">{renderTextWithLinks(m.text)}</p>}
                  <span className={cn("text-[10px] mt-1 block opacity-70", isMe ? "text-blue-200 text-right" : "text-zinc-500")}>
                    {formatDistanceToNow(new Date(m.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })}
        </main>

        <footer className="border-t border-zinc-900 bg-black p-3 pb-safe absolute bottom-0 left-0 right-0 z-30">
          <div className="flex items-end gap-2 bg-zinc-900/80 rounded-2xl p-2 border border-zinc-800 focus-within:border-zinc-700 transition-colors">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white shrink-0 transition-colors">
              <Paperclip size={20} />
            </button>
            <textarea 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Message..." 
              className="flex-1 bg-transparent text-white placeholder-zinc-500 max-h-32 resize-none py-2 outline-none text-sm leading-relaxed"
              rows={1}
            />
            <button 
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              className={cn("p-2 shrink-0 transition-colors rounded-full", isRecording ? "bg-rose-500/20 text-rose-500" : "text-zinc-400 hover:text-white")}
            >
              <Mic size={20} />
            </button>
            <button 
              onClick={handleSend}
              disabled={!messageText.trim()}
              className="p-2 text-blue-500 hover:text-blue-400 disabled:opacity-50 shrink-0 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // List view (mocked)
  const dummyConversations = [
    { id: 1, participant: { displayName: 'John Doe', avatar: 'https://i.pravatar.cc/150?u=1' }, lastMessage: 'Check out this link: https://google.com', timestamp: new Date().toISOString(), unreadCount: 1 }
  ];

  return (
    <div className="flex flex-col h-full bg-black">
      {!hideHeader && (
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">Messages</h1>
          <button className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <Edit size={18} />
          </button>
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 px-2 pt-4">
        {dummyConversations.map((chat) => (
          <div key={chat.id} onClick={() => setActiveChat(chat.participant)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-900/50 cursor-pointer transition-colors">
            <div className="relative w-14 h-14 shrink-0">
              <img src={chat.participant.avatar} className="w-full h-full rounded-full object-cover bg-zinc-800" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white truncate pr-2">{chat.participant.displayName}</span>
              </div>
              <p className="text-sm text-zinc-400 truncate">{chat.lastMessage}</p>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
