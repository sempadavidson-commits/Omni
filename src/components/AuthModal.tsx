import React, { useState, useEffect } from 'react';
import { X, Mail, ArrowLeft, Loader2, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

type AuthViewMode = 'select' | 'signin' | 'signup';

export function AuthModal() {
  const { isAuthModalOpen, authAction, closeAuthModal, login } = useAppContext();
  const [mode, setMode] = useState<AuthViewMode>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setMode('select');
      setEmail('');
      setPassword('');
      setDisplayName('');
      setShowPassword(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const syncBackendUser = async (firebaseUser: any, customDisplayName?: string) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: customDisplayName || firebaseUser.displayName || 'Creator',
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dbUser) {
          login({
            id: data.dbUser.uid,
            uid: data.dbUser.uid,
            username: data.dbUser.username,
            displayName: data.dbUser.displayName,
            avatar: data.dbUser.avatar,
            bio: data.dbUser.bio,
            followersCount: data.dbUser.followersCount,
            followingCount: data.dbUser.followingCount,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Backend user registration sync note:', e);
    }

    login({
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      displayName: customDisplayName || firebaseUser.displayName || 'Creator',
      username: (customDisplayName || firebaseUser.displayName || 'user')
        .toLowerCase()
        .replace(/\s+/g, '') + firebaseUser.uid.substring(0, 4),
      avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
      followersCount: 0,
      followingCount: 0
    });
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      await syncBackendUser(result.user);
      closeAuthModal();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setIsSubmitting(false);
        return;
      }
      setError(err.message || 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncBackendUser(cred.user);
      closeAuthModal();
    } catch (err: any) {
      console.error(err);
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, {
        displayName: displayName.trim(),
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`
      });
      await syncBackendUser(cred.user, displayName.trim());
      closeAuthModal();
    } catch (err: any) {
      console.error(err);
      let msg = 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85  animate-in fade-in duration-200">
      <motion.div
        layout
        className="bg-[#0e1017] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          {mode !== 'select' ? (
            <button
              onClick={() => {
                setMode('select');
                setError(null);
              }}
              className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.05] transition-colors"
            >
              <ArrowLeft size={19} />
            </button>
          ) : (
            <div className="w-8" />
          )}

          <div className="flex flex-col items-center text-center">
            <h2 className="text-base font-black text-white tracking-wide uppercase">
              {mode === 'select'
                ? authAction?.actionName || 'NEXUS AUTH'
                : mode === 'signin'
                ? 'Welcome Back'
                : 'Create Account'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {authAction?.message || 'Sign in to access your creator profile and feed.'}
            </p>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-2 -mr-2 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.05] transition-colors"
          >
            <X size={19} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 text-rose-300 text-xs font-medium animate-in fade-in">
            {error}
          </div>
        )}

        {/* Mode Switcher */}
        <AnimatePresence mode="wait">
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-3 py-2"
            >
              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white text-black font-bold text-xs hover:bg-slate-100 active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin text-black" />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center my-1">
                <div className="flex-1 h-[1px] bg-white/[0.08]" />
                <span className="px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-[1px] bg-white/[0.08]" />
              </div>

              {/* Email & Password Sign In Option */}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-white/[0.06] text-white font-semibold text-xs hover:bg-white/[0.1] active:scale-[0.98] transition-all"
              >
                <Mail size={15} className="text-cyan-400" />
                <span>Sign In with Email</span>
              </button>

              {/* Create Account Option */}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-cyan-400/10 text-cyan-300 font-semibold text-xs hover:bg-cyan-400/20 active:scale-[0.98] transition-all"
              >
                <User size={15} />
                <span>Create New Account</span>
              </button>
            </motion.div>
          )}

          {mode === 'signin' && (
            <motion.form
              key="signin"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleEmailSignIn}
              className="flex flex-col gap-3 py-1"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 ml-1">Email</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] focus-within:bg-white/[0.08] transition-colors">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoFocus
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 ml-1">Password</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] focus-within:bg-white/[0.08] transition-colors">
                  <Lock size={15} className="text-slate-400 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-cyan-400 text-black font-extrabold text-xs hover:bg-cyan-300 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin text-black" /> : 'Sign In'}
              </button>

              <div className="flex items-center justify-between text-[11px] mt-1 text-slate-400">
                <span>No account yet?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-cyan-300 font-bold hover:underline"
                >
                  Create one now
                </button>
              </div>
            </motion.form>
          )}

          {mode === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleEmailSignUp}
              className="flex flex-col gap-3 py-1"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 ml-1">Creator Name</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] focus-within:bg-white/[0.08] transition-colors">
                  <User size={15} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    autoFocus
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 ml-1">Email</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] focus-within:bg-white/[0.08] transition-colors">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 ml-1">Password</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] focus-within:bg-white/[0.08] transition-colors">
                  <Lock size={15} className="text-slate-400 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-cyan-400 text-black font-extrabold text-xs hover:bg-cyan-300 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin text-black" /> : 'Register Creator Account'}
              </button>

              <div className="flex items-center justify-between text-[11px] mt-1 text-slate-400">
                <span>Already registered?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-cyan-300 font-bold hover:underline"
                >
                  Sign in
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
