import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface OmniBrandLoaderProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export function OmniBrandLoader({ onComplete, minDurationMs = 1500 }: OmniBrandLoaderProps) {
  // Sequence phases:
  // 0: Initial N glowing glyph
  // 1: Expansion to NEX
  // 2: Full resolution into NEXUS with energetic halo
  // 3: Fade out transition
  const [phase, setPhase] = useState<number>(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);   // N -> NEX
    const t2 = setTimeout(() => setPhase(2), 900);   // NEX -> NEXUS
    const t3 = setTimeout(() => {
      setPhase(3);
      setTimeout(() => {
        setFinished(true);
        if (onComplete) onComplete();
      }, 400);
    }, Math.max(minDurationMs, 1400));

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [minDurationMs, onComplete]);

  if (finished) return null;

  return (
    <AnimatePresence>
      {phase < 3 && (
        <motion.div
          key="omni-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07080c] select-none pointer-events-none"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

          <div className="relative flex flex-col items-center">
            {/* Monolithic Logo Monogram Mark */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative mb-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 via-indigo-500/10 to-transparent border-cyan-400/40 flex items-center justify-center shadow-[0_0_35px_rgba(0,240,255,0.25)]">
                {/* Custom Stylized Geometric OMNI Emblem */}
                <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 4L31 11.5V24.5L18 32L5 24.5V11.5L18 4Z"
                    stroke="#00f0ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="18" cy="18" r="4.5" fill="#00f0ff" />
                </svg>
              </div>
            </motion.div>

            {/* Typography Transformation: N -> NEX -> NEXUS */}
            <div className="h-10 flex items-center justify-center overflow-hidden">
              <div className="flex items-center text-2xl md:text-3xl font-black tracking-[0.25em] text-white">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-cyan-400 font-extrabold"
                >
                  N
                </motion.span>

                <AnimatePresence mode="wait">
                  {phase >= 1 && (
                    <motion.span
                      key="ex"
                      initial={{ opacity: 0, width: 0, x: -10 }}
                      animate={{ opacity: 1, width: 'auto', x: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="inline-block overflow-hidden whitespace-nowrap text-white"
                    >
                      EX
                    </motion.span>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {phase >= 2 && (
                    <motion.span
                      key="us"
                      initial={{ opacity: 0, width: 0, x: -10 }}
                      animate={{ opacity: 1, width: 'auto', x: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="inline-block overflow-hidden whitespace-nowrap text-cyan-200"
                    >
                      US
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Subtle Brand Tagline with Smooth Stagger */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: phase >= 2 ? 0.6 : 0, y: phase >= 2 ? 0 : 6 }}
              transition={{ duration: 0.4 }}
              className="text-[11px] font-medium tracking-[0.35em] text-slate-400 uppercase mt-2.5"
            >
              Omni Social Video
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
