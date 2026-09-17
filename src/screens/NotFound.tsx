import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();
  return <div className="grid h-full place-items-center bg-[#0b0b0a] px-6 text-center text-[#f7f5f0]"><main className="max-w-sm"><p className="text-sm font-semibold text-[#ff6b4a]">404</p><h1 className="mt-2 text-2xl font-bold">This place does not exist</h1><p className="mt-3 text-sm leading-6 text-[#b7b2a8]">The link may be old, private, or incomplete. Your account and content have not been changed.</p><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => navigate(-1)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15"><ArrowLeft size={17}/>Go back</button><button onClick={() => navigate('/', { replace: true })} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ff6b4a] font-bold text-[#0b0b0a]"><Home size={17}/>Home</button></div></main></div>;
}
