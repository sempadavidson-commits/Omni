import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';

interface SplashProps {
  onReady: () => void;
}

export function Splash({ onReady }: SplashProps) {
  const { isInitialized } = useAppContext();
  
  // Phase 0: "N-Nex" displaying with kinetic entrance
  // Phase 1: morphs smoothly into "nexus" in lowercase with radiant glow
  const [phase, setPhase] = useState<'intro' | 'morphed'>('intro');
  const [animationDone, setAnimationDone] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const onReadyCalledRef = useRef(false);

  useEffect(() => {
    // Slow, visible, and engaging transformation:
    // Step 1: N-Nex shows for 1.1s
    const t1 = setTimeout(() => {
      setPhase('morphed');
    }, 1100);

    // Step 2: nexus holds with radiant particle shimmer for another 1.4s
    const t2 = setTimeout(() => {
      setAnimationDone(true);
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Exit when animation finishes and app initialized
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (animationDone && !isExiting) {
        setIsExiting(true);
      }
    }, 4500);

    if (animationDone && isInitialized && !isExiting) {
      setIsExiting(true);
    }

    return () => clearTimeout(safetyTimer);
  }, [animationDone, isInitialized, isExiting]);

  const handleExitComplete = () => {
    if (!onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      onReady();
    }
  };

  useEffect(() => {
    if (isExiting) {
      const fallbackTimer = setTimeout(() => {
        handleExitComplete();
      }, 700);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isExiting]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <motion.div
          key="nexus-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07080c] select-none pointer-events-auto overflow-hidden"
        >
          {/* Subtle Ambient Radial Glow */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0.3 }}
            animate={{ scale: phase === 'morphed' ? 1.4 : 1, opacity: phase === 'morphed' ? 0.7 : 0.4 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            className="absolute w-96 h-96 rounded-full bg-gradient-to-tr from-cyan-500/20 via-indigo-500/15 to-transparent blur-[120px] pointer-events-none"
          />

          {/* Animated Brand Typography */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="h-20 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                {phase === 'intro' ? (
                  <motion.div
                    key="splash-n-nex"
                    initial={{ opacity: 0, scale: 0.9, letterSpacing: '0.15em', y: 10 }}
                    animate={{ opacity: 1, scale: 1, letterSpacing: '0.35em', y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="text-4xl sm:text-5xl font-black text-white tracking-[0.35em] drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
                  >
                    <span className="text-cyan-400">N-</span>
                    <span>Nex</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="splash-nexus"
                    initial={{ opacity: 0, scale: 1.08, letterSpacing: '0.45em', y: 10, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, scale: 1, letterSpacing: '0.32em', y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                    className="text-4xl sm:text-5xl font-black tracking-[0.32em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-cyan-400 drop-shadow-[0_0_35px_rgba(0,240,255,0.6)]"
                  >
                    nexus
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Glowing underline accent */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: phase === 'morphed' ? 80 : 40, opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] mt-4"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
