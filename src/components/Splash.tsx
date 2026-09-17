import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';

interface SplashProps { onReady: () => void; }

export function Splash({ onReady }: SplashProps) {
  const { isInitialized } = useAppContext();
  const [isExiting, setIsExiting] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    const earliestExit = window.setTimeout(() => { if (isInitialized) setIsExiting(true); }, 650);
    const safetyExit = window.setTimeout(() => setIsExiting(true), 2200);
    return () => { window.clearTimeout(earliestExit); window.clearTimeout(safetyExit); };
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      const timer = window.setTimeout(() => setIsExiting(true), 650);
      return () => window.clearTimeout(timer);
    }
  }, [isInitialized]);

  const finish = () => {
    if (!calledRef.current) { calledRef.current = true; onReady(); }
  };

  return (
    <AnimatePresence onExitComplete={finish}>
      {!isExiting && (
        <motion.div key="omni-splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0b0a] select-none">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f7f5f0] text-[#0b0b0a] grid place-items-center text-2xl font-black tracking-[-0.08em]">O</div>
            <p className="mt-4 text-[15px] font-semibold tracking-[0.24em] text-[#f7f5f0]">OMNI</p>
            <p className="mt-2 text-xs text-[#817c73]">Made for real moments.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
