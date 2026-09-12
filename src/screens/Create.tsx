import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Video, Mic, MapPin, Globe, Camera, ArrowRight, Music, Type, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

export function Create() {
  const navigate = useNavigate();
  const { syncState, dispatchEvent, requireAuth } = useAppContext();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'camera' | 'edit' | 'post'>('camera');
  
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
    
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaUrl(e.target?.result as string);
        setIsProcessing(false);
        setStep('post');
      };
      reader.readAsDataURL(file);
    }, 100);
  };

  const handlePost = () => {
    requireAuth('Create Post', 'Sign in to share your post.', () => {
      const newPost = {
        id: Date.now(),
        authorId: 'me',
        content: mediaUrl || '',
        caption: content,
        type: mediaType,
        createdAt: new Date().toISOString(),
        likesCount: 0,
        commentsCount: 0,
        repostsCount: 0,
      };

      dispatchEvent({
        objectId: newPost.id.toString(),
        operation: 'CREATE',
        payload: { targetType: 'POST', data: newPost }
      });

      navigate('/');
    });
  };

  if (step === 'camera') {
    return (
      <div className="flex flex-col h-full bg-black relative z-50 overflow-hidden">
        <div className="absolute top-12 left-4 z-50">
          <button onClick={() => navigate(-1)} className="text-white p-2">
            <X size={28} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Fake camera viewfinder */}
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
             <Camera size={64} className="text-zinc-800" />
          </div>
          
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-8 z-10">
            <div className="flex items-center gap-12">
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 backdrop-blur-md flex items-center justify-center border border-zinc-700">
                  <ImageIcon size={20} className="text-white" />
                </div>
                <span className="text-white text-xs font-medium drop-shadow-md">Upload</span>
              </div>
              
              <div className="w-20 h-20 rounded-full border-[6px] border-white/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" onClick={() => fileInputRef.current?.click()}>
                <div className="w-14 h-14 bg-red-500 rounded-full"></div>
              </div>
              
              <div className="flex flex-col items-center gap-2 opacity-50">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 backdrop-blur-md flex items-center justify-center border border-zinc-700">
                  <Check size={20} className="text-white" />
                </div>
                <span className="text-white text-xs font-medium drop-shadow-md">Templates</span>
              </div>
            </div>
            
            <div className="flex gap-6 text-sm font-semibold drop-shadow-md mt-4">
              <span className="text-white">Video</span>
              <span className="text-white/60">Photo</span>
              <span className="text-white/60">Text</span>
            </div>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black z-50">
      <header className="flex items-center justify-between px-4 py-4 border-b border-zinc-900 bg-black">
        <button 
          onClick={() => setStep('camera')}
          className="text-zinc-400 hover:text-white transition-colors p-1"
        >
          <X size={24} />
        </button>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePost}
            disabled={isProcessing || (!mediaUrl && !content)}
            className="bg-[#fe2c55] text-white font-semibold py-1.5 px-6 rounded-full text-sm hover:bg-[#ef2950] transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Post'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 flex flex-col">
        <div className="p-4 flex gap-4 border-b border-zinc-900/50">
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a caption... #hashtags @mentions"
              className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 border-none outline-none resize-none min-h-[100px]"
              maxLength={280}
            />
          {mediaUrl && (
            <div className="w-24 h-32 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800 relative">
              {mediaType === 'video' ? (
                <video src={mediaUrl} className="w-full h-full object-cover" />
              ) : (
                <img src={mediaUrl} className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-col mt-4">
          <div className="flex items-center justify-between px-4 py-4 hover:bg-zinc-900/50 transition-colors cursor-pointer border-b border-zinc-900/30">
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-zinc-400" />
              <span className="text-white text-sm">Everyone can view</span>
            </div>
            <ArrowRight size={16} className="text-zinc-600" />
          </div>
          <div className="flex items-center justify-between px-4 py-4 hover:bg-zinc-900/50 transition-colors cursor-pointer border-b border-zinc-900/30">
            <div className="flex items-center gap-3">
              <MapPin size={20} className="text-zinc-400" />
              <span className="text-white text-sm">Add location</span>
            </div>
            <ArrowRight size={16} className="text-zinc-600" />
          </div>
        </div>
      </main>
    </div>
  );
}
