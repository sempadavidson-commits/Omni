import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Lock, MessageCircle, Upload, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { publishPost } from '../lib/publishPost';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

type Visibility = 'public' | 'followers' | 'private';

export function CreateSimple() {
  const navigate = useNavigate();
  const { requireAuth } = useAppContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    abortRef.current?.abort();
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const selectFile = (next: File) => {
    setError('');
    if (!next.size || next.size > 512 * 1024 * 1024 || (!next.type.startsWith('image/') && !next.type.startsWith('video/'))) {
      setError('Choose a non-empty photo or video no larger than 512 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = () => requireAuth('Publish', 'Sign in to publish on Omni.', () => {
    if (!file) return;
    void (async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPublishing(true);
      setProgress(0);
      setError('');
      try {
        const post = await publishPost({ file, caption, visibility, allowComments }, setProgress, controller.signal);
        navigate(`/post/${post.id}`, { replace: true });
      } catch (reason) {
        if ((reason as Error).name !== 'AbortError') setError((reason as Error).message || 'Nothing was posted.');
        setPublishing(false);
      } finally {
        abortRef.current = null;
      }
    })();
  });

  return <div className="h-full overflow-y-auto bg-[#0b0b0a] pb-24 text-[#f7f5f0]">
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#0b0b0a]/95 px-4 backdrop-blur-xl">
      <button onClick={() => navigate(-1)} aria-label="Close creator" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"><ArrowLeft size={21}/></button>
      <div className="text-center"><h1 className="text-sm font-semibold">Create</h1><p className="text-[11px] text-[#817c73]">Published only after persistence</p></div><div className="w-11"/>
    </header>
    <main className="mx-auto w-full max-w-md space-y-5 p-4">
      {!file ? <button onClick={() => inputRef.current?.click()} className="flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/20 bg-[#151513] px-8 text-center hover:border-[#ff6b4a]">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ff6b4a]/10 text-[#ff6b4a]"><ImagePlus/></span><span><b className="block">Choose a photo or video</b><small className="mt-1 block text-[#b7b2a8]">Up to 512 MB</small></span><span className="rounded-xl bg-[#f7f5f0] px-4 py-2 text-sm font-semibold text-[#0b0b0a]">Browse media</span>
      </button> : <section className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        {file.type.startsWith('video/') ? <video src={preview} controls playsInline className="max-h-[54vh] w-full object-contain"/> : <img src={preview} alt="Selected media" className="max-h-[54vh] w-full object-contain"/>}
        {!publishing && <button onClick={() => { setFile(null); URL.revokeObjectURL(preview); setPreview(''); }} className="w-full border-t border-white/10 py-3 text-sm">Choose different media</button>}
      </section>}
      <input ref={inputRef} type="file" accept="video/*,image/*" className="hidden" onChange={event => event.target.files?.[0] && selectFile(event.target.files[0])}/>
      {file && <section className="space-y-4 rounded-2xl border border-white/10 bg-[#151513] p-4">
        <textarea value={caption} disabled={publishing} onChange={event => setCaption(event.target.value)} maxLength={2200} placeholder="Add context, credits, and #topics" className="min-h-28 w-full resize-none rounded-xl border border-white/10 bg-[#0b0b0a] p-3 text-sm outline-none focus:border-[#ff6b4a]"/>
        <div className="grid grid-cols-3 gap-2">{([['public','Everyone',Upload],['followers','Followers',Users],['private','Only me',Lock]] as const).map(([value,label,Icon]) => <button type="button" key={value} disabled={publishing} onClick={() => setVisibility(value)} className={cn('flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs', visibility === value ? 'border-[#ff6b4a] bg-[#ff6b4a]/10 text-[#ff8a70]' : 'border-white/10 text-[#b7b2a8]')}><Icon size={18}/>{label}</button>)}</div>
        <button type="button" disabled={publishing} onClick={() => setAllowComments(value => !value)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-white/10 px-3"><span className="flex items-center gap-3 text-sm"><MessageCircle size={18}/>Allow comments</span><b>{allowComments ? 'On' : 'Off'}</b></button>
      </section>}
      {publishing ? <section className="rounded-2xl border border-white/10 bg-[#151513] p-4"><div className="mb-3 flex justify-between text-sm"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin text-[#ff6b4a]" size={17}/>Publishing</span><b>{progress}%</b></div><div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff6b4a]" style={{width:`${progress}%`}}/></div><button onClick={() => abortRef.current?.abort()} className="mt-4 w-full rounded-xl border border-white/15 py-3 text-sm">Cancel</button></section> : file && <button onClick={submit} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b4a] font-bold text-[#0b0b0a]"><Check size={19}/>Publish</button>}
      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      <p className="text-center text-xs leading-5 text-[#817c73]">No simulated success. Omni confirms only after media and post data are persisted.</p>
    </main>
  </div>;
}
