import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Video, Mic, MapPin, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function Create() {
  const navigate = useNavigate();
  const { syncState, dispatchEvent, requireAuth } = useAppContext();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      alert('File is too large! Please select a file under 25MB.');
      return;
    }

    setIsProcessing(true);
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    
    // For large files, setTimeout allows the UI to render the loading state first
    setTimeout(() => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result as string);
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }, 100);
  };

  const handlePost = () => {
    requireAuth('Post', 'Sign in to share your thoughts.', () => {
      if (isProcessing) return;
      setIsProcessing(true);
      
      // Dispatch local CREATE event to the Sync Engine
      dispatchEvent({
        operation: 'CREATE',
        payload: {
          targetType: 'POST',
          data: {
            type: mediaUrl ? mediaType : 'text',
            content: mediaUrl || content, // If media, put url in content
            caption: mediaUrl ? content : content // Use content as caption if media is present
          }
        }
      });

      // Navigate immediately (Optimistic UI)
      setTimeout(() => {
        setIsProcessing(false);
        navigate('/');
      }, 150);
    });
  };

  const isOffline = syncState === 'OFFLINE' || syncState === 'PEER_AVAILABLE';

  return (
    <div className="flex flex-col h-full bg-black z-50 animate-in slide-in-from-bottom-12 duration-300">
      <header className="flex items-center justify-between px-4 py-4 border-b border-zinc-900 bg-black/90 backdrop-blur-xl">
        <button 
          onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-white transition-colors p-1"
        >
          <X size={24} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-500 flex items-center gap-1 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            <Globe size={12} /> Public
          </span>
          <button 
            onClick={handlePost}
            disabled={(!content.trim() && !mediaUrl) || isProcessing}
            className="bg-white text-black font-semibold py-1.5 px-5 rounded-full text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isProcessing ? 'Processing...' : 'Post'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 relative overflow-y-auto pb-24 hide-scrollbar">
        {isOffline && (
          <div className="mb-4 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-2 rounded-lg flex items-center gap-2 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6.5 15"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/></svg>
            No internet connection. Post will be saved locally and synced automatically.
          </div>
        )}

        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
          className="w-full bg-transparent text-white text-xl placeholder-zinc-600 resize-none outline-none min-h-[120px] shrink-0"
        />

        {isProcessing && !mediaUrl && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-500 border-t-white rounded-full"></div>
          </div>
        )}

        {mediaUrl && (
          <div className="relative mt-2 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
            <button 
              onClick={() => { setMediaUrl(null); setMediaType('text'); }}
              className="absolute top-2 right-2 z-10 bg-black/60 p-1.5 rounded-full text-white hover:bg-black transition-colors"
            >
              <X size={16} />
            </button>
            {mediaType === 'video' ? (
              <video src={mediaUrl} className="w-full max-h-[400px] object-cover" controls playsInline />
            ) : (
              <img src={mediaUrl} alt="Upload preview" className="w-full max-h-[400px] object-cover" />
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="fixed bottom-[4.5rem] md:bottom-[4.5rem] lg:bottom-4 left-4 right-4 flex items-center gap-2 pt-4 bg-black z-10 md:static md:mt-auto md:border-t md:border-zinc-900 md:bg-transparent">
          <input 
            type="file" 
            accept="image/*,video/*" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400 hover:bg-zinc-800 transition-colors"
          >
            <ImageIcon size={20} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400 hover:bg-zinc-800 transition-colors"
          >
            <Video size={20} />
          </button>
          <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-400 hover:bg-zinc-800 transition-colors">
            <Mic size={20} />
          </button>
          <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 hover:bg-zinc-800 transition-colors">
            <MapPin size={20} />
          </button>
        </div>
      </main>
    </div>
  );
}
