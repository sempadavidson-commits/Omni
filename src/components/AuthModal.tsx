import React, { useState, useEffect } from 'react';
import { X, Mail, Smartphone, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';

type AuthMode = 'select' | 'email' | 'phone';

export function AuthModal() {
  const { isAuthModalOpen, authAction, closeAuthModal, login } = useAppContext();
  const [mode, setMode] = useState<AuthMode>('select');
  const [inputValue, setInputValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode('select');
      setInputValue('');
      setNameValue('');
      setIsSubmitting(false);
      setError(null);
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen || !authAction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValue.trim() || !inputValue.trim()) return;
    
    setIsSubmitting(true);
    
    // Simulate network delay for realistic feel
    setTimeout(() => {
      login({
        displayName: nameValue.trim(),
        username: nameValue.toLowerCase().replace(/\s+/g, '_') + Math.floor(Math.random() * 100),
      });
    }, 800);
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Register the user with our backend
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Registration failed');
      
      const data = await res.json();
      
      login({
        id: data.uid,
        displayName: user.displayName || 'Google User',
        username: 'google_user_' + Math.floor(Math.random() * 1000),
        avatar: user.photoURL || undefined
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        
        <div className="flex justify-between items-center p-4 border-b border-zinc-800 relative">
          {mode !== 'select' && (
            <button 
              onClick={() => setMode('select')} 
              className="absolute left-4 p-2 -ml-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className={`text-lg font-bold text-white tracking-wide ${mode !== 'select' ? 'mx-auto' : ''}`}>
            {mode === 'select' ? authAction.actionName : 'Create Account'}
          </h2>
          <button 
            onClick={closeAuthModal} 
            className={`p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors ${mode !== 'select' ? 'absolute right-4 -mr-2' : ''}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          {mode === 'select' ? (
            <>
              <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <p className="text-zinc-300 mb-8">{authAction.message}</p>
              
              {error && (
                <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-2 px-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="w-full space-y-3">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-xl font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={20} className="animate-spin text-black" /> : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => setMode('email')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-800 text-white py-3.5 rounded-xl font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-50"
                >
                  <Mail size={20} />
                  Continue with Email
                </button>
                
                <button 
                  onClick={() => setMode('phone')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-800 text-white py-3.5 rounded-xl font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-50"
                >
                  <Smartphone size={20} />
                  Continue with Phone
                </button>
              </div>
              
              <button 
                onClick={closeAuthModal}
                disabled={isSubmitting}
                className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors disabled:opacity-50"
              >
                Not now
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                    {mode === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <input
                    type={mode === 'email' ? 'email' : 'tel'}
                    required
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={mode === 'email' ? 'jane@example.com' : '+1 (555) 000-0000'}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              
              <button 
                type="submit"
                disabled={isSubmitting || !nameValue || !inputValue}
                className="w-full flex items-center justify-center gap-2 bg-white text-black py-3.5 rounded-xl font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:bg-zinc-400 mt-6"
              >
                {isSubmitting && <Loader2 size={18} className="animate-spin text-black" />}
                {isSubmitting ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
