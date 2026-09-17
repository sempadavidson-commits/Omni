import React, { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#0b0b0a] text-[#f7f5f0] flex items-center justify-center p-6">
          <div className="w-full max-w-sm border border-white/15 rounded-2xl bg-[#151513] p-6 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ff8064] mb-3">Omni</p>
            <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-[#b7b2a8] mb-6">Your account and posts are safe. Reload the app to try again.</p>
            <button onClick={() => window.location.reload()} className="w-full min-h-11 rounded-xl bg-[#f7f5f0] text-[#0b0b0a] font-semibold">Reload Omni</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for offline persistence and progressive web app capabilities
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
