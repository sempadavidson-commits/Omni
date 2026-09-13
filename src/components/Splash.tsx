import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';

interface SplashProps {
  onReady: () => void;
}

export function Splash({ onReady }: SplashProps) {
  const { isInitialized } = useAppContext();
  
  // Brand animation sequence phases:
  // 0: 'N'
  // 1: 'NEX'
  // 2: 'NEXUS'
  const [phase, setPhase] = useState<number>(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  // Prevent duplicate callbacks
  const onReadyCalledRef = useRef(false);

  // Timed sequence for N -> NEX -> NEXUS
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);  // N -> NEX
    const t2 = setTimeout(() => setPhase(2), 1100); // NEX -> NEXUS
    const t3 = setTimeout(() => setAnimationDone(true), 1800); // Animation finished

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Ensure transition only occurs when BOTH animation finishes and app state is initialized
  useEffect(() => {
    // Safety fallback: if app takes more than 4s, proceed anyway
    const safetyTimer = setTimeout(() => {
      if (animationDone && !isExiting) {
        setIsExiting(true);
      }
    }, 4000);

    if (animationDone && isInitialized && !isExiting) {
      setIsExiting(true);
    }

    return () => clearTimeout(safetyTimer);
  }, [animationDone, isInitialized, isExiting]);

  // When exiting, call onReady after the exit transition completes
  const handleExitComplete = () => {
    if (!onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      onReady();
    }
  };

  // Fallback timer if motion animation callback doesn't trigger
  useEffect(() => {
    if (isExiting) {
      const fallbackTimer = setTimeout(() => {
        handleExitComplete();
      }, 600);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isExiting]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <motion.div
          key="nexus-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07080c] select-none pointer-events-auto"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

          {/* Morphing Kinetic Monogram */}
          <div className="relative flex flex-col items-center">
            <motion.div
              layout
              className="relative flex items-center justify-center mb-6"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="w-16 h-16 rounded-2xl bg-cyan-400 text-black flex items-center justify-center shadow-[0_0_40px_rgba(0,240,255,0.35)]"
              >
                <span className="font-black text-2xl tracking-tighter">N</span>
              </motion.div>
            </motion.div>

            {/* Branded Sequence Typography: N -> NEX -> NEXUS */}
            <div className="h-10 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                {phase === 0 && (
                  <motion.div
                    key="step-n"
                    initial={{ opacity: 0, y: 8, letterSpacing: '0.1em' }}
                    animate={{ opacity: 1, y: 0, letterSpacing: '0.25em' }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="text-2xl font-black text-white tracking-[0.25em]"
                  >
                    N
                  </motion.div>
                )}

                {phase === 1 && (
                  <motion.div
                    key="step-nex"
                    initial={{ opacity: 0, y: 8, letterSpacing: '0.15em' }}
                    animate={{ opacity: 1, y: 0, letterSpacing: '0.3em' }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="text-2xl font-black text-cyan-300 tracking-[0.3em]"
                  >
                    NEX
                  </motion.div>
                )}

                {phase >= 2 && (
                  <motion.div
                    key="step-nexus"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 tracking-[0.35em]"
                  >
                    NEXUS
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* State Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex items-center gap-1.5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Initializing Network
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
