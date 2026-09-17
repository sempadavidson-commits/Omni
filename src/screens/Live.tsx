import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, Mic, Radio, ShieldCheck, Signal, Users, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const LIVE_SERVICE_CONFIGURED = Boolean(import.meta.env.VITE_LIVE_CONTROL_URL);

export function Live() {
  const navigate = useNavigate();
  const { requireAuth } = useAppContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  };
  useEffect(() => stopPreview, []);

  const checkDevices = async () => {
    setChecking(true); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);
    } catch { setError('Camera and microphone access are required for live broadcasting.'); }
    finally { setChecking(false); }
  };

  const requestBroadcast = () => requireAuth('Go live', 'Sign in to start a verified broadcast.', () => {
    setError(LIVE_SERVICE_CONFIGURED ? 'Live control is configured, but the ingest handshake still needs implementation.' : 'Live infrastructure is not connected. No fake broadcast was created.');
  });

  return <div className="h-full overflow-y-auto bg-[#0b0b0a] pb-24 text-[#f7f5f0]">
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#0b0b0a]/95 px-4 backdrop-blur-xl"><button onClick={() => navigate(-1)} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"><ArrowLeft size={21}/></button><div className="flex items-center gap-2 text-sm font-semibold"><Radio size={17} className="text-[#ff6b4a]"/>Omni Live</div><div className="w-11"/></header>
    <main className="mx-auto w-full max-w-md space-y-5 p-4">
      <section className="relative aspect-[9/16] max-h-[62vh] overflow-hidden rounded-2xl border border-white/10 bg-[#151513]"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>{!ready ? <div className="absolute inset-0 grid place-items-center p-8 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#ff6b4a]/10 text-[#ff6b4a]"><Camera size={28}/></span><h1 className="mt-4 text-xl font-bold">Prepare a real broadcast</h1><p className="mt-2 text-sm leading-6 text-[#b7b2a8]">Check camera, microphone, connection and safety before anyone joins.</p><button onClick={checkDevices} disabled={checking} className="mt-5 min-h-12 rounded-xl bg-[#f7f5f0] px-5 font-semibold text-[#0b0b0a]">{checking?'Checking…':'Check camera & mic'}</button></div></div> : <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4"><span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs"><CheckCircle2 size={14} className="text-emerald-400"/>Preview only</span><button onClick={stopPreview} aria-label="Stop preview" className="grid h-10 w-10 place-items-center rounded-full bg-black/60"><XCircle size={19}/></button></div>}</section>
      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#151513] p-4"><input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="What will happen live?" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0b0a] px-3 text-sm outline-none focus:border-[#ff6b4a]"/><div className="grid grid-cols-3 gap-2 text-center text-xs text-[#b7b2a8]"><div className="rounded-xl border border-white/10 p-3"><Camera className="mx-auto mb-2" size={18}/>1080p</div><div className="rounded-xl border border-white/10 p-3"><Mic className="mx-auto mb-2" size={18}/>Clean audio</div><div className="rounded-xl border border-white/10 p-3"><ShieldCheck className="mx-auto mb-2" size={18}/>Safety</div></div><button onClick={requestBroadcast} disabled={!ready || !title.trim()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b4a] font-bold text-[#0b0b0a] disabled:opacity-40"><Signal size={19}/>Request broadcast</button></section>
      {!LIVE_SERVICE_CONFIGURED && <section className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4"><h2 className="font-semibold text-amber-200">Live is not production-ready</h2><p className="mt-2 text-sm leading-6 text-[#b7b2a8]">The old screen fabricated sessions, viewers, guests, comments and milestones in local state. Omni needs WebRTC ingest, an SFU, adaptive playback, server-authoritative presence, moderation and replay review before real broadcasting can ship.</p></section>}
      <section className="space-y-3 rounded-2xl border border-white/10 p-4"><h2 className="font-semibold">Required production systems</h2><p className="flex gap-3 text-sm text-[#b7b2a8]"><Signal size={18} className="shrink-0 text-[#ff6b4a]"/>Regional ingest, reconnect and latency telemetry.</p><p className="flex gap-3 text-sm text-[#b7b2a8]"><Users size={18} className="shrink-0 text-[#ff6b4a]"/>Real sessions, presence, invitations and host controls.</p><p className="flex gap-3 text-sm text-[#b7b2a8]"><ShieldCheck size={18} className="shrink-0 text-[#ff6b4a]"/>Age gates, reporting and human moderation.</p></section>
      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
    </main>
  </div>;
}
