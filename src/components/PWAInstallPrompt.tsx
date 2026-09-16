import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isInstalled || isDismissed) {
    return null;
  }

  if (isInstallable) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-gradient-to-r from-cyan-950/90 to-purple-950/90 border border-cyan-500/30 backdrop-blur-xl rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <Download size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">Install Omni App</p>
            <p className="text-[10px] text-slate-300 truncate">Add to home screen for fullscreen experience</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
          >
            Install
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss"
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-[#12141f] border border-white/10 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download size={18} className="text-cyan-400" /> Install Omni on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.04]">
                  <Share size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>1. Tap the <strong className="text-white">Share</strong> button at the bottom of Safari.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.04]">
                  <PlusSquare size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
