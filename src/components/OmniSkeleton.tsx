import React from 'react';
import { cn } from '../lib/utils';

interface OmniSkeletonProps {
  className?: string;
}

export function OmniSkeleton({ className }: OmniSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/[0.04] border-white/[0.03]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent",
        className
      )}
    />
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="relative w-full h-full bg-[#07080c] flex flex-col justify-between p-4 overflow-hidden">
      {/* Top Header Placeholder */}
      <div className="flex items-center justify-between pt-safe z-10">
        <OmniSkeleton className="w-24 h-8 rounded-full" />
        <OmniSkeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Center ambient pulse */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full  flex items-center justify-center animate-pulse">
          <div className="w-8 h-8 rounded-full bg-cyan-500/10" />
        </div>
      </div>

      {/* Right Action Rail Placeholder */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-10">
        <OmniSkeleton className="w-11 h-11 rounded-full" />
        <OmniSkeleton className="w-10 h-10 rounded-full" />
        <OmniSkeleton className="w-10 h-10 rounded-full" />
        <OmniSkeleton className="w-10 h-10 rounded-full" />
        <OmniSkeleton className="w-10 h-10 rounded-full" />
      </div>

      {/* Bottom Metadata Placeholder */}
      <div className="z-10 pb-20 max-w-[75%] space-y-2">
        <div className="flex items-center gap-2">
          <OmniSkeleton className="w-8 h-8 rounded-full" />
          <OmniSkeleton className="w-28 h-4 rounded-md" />
        </div>
        <OmniSkeleton className="w-full h-4 rounded-md" />
        <OmniSkeleton className="w-2/3 h-4 rounded-md" />
        <OmniSkeleton className="w-32 h-6 rounded-full mt-2" />
      </div>
    </div>
  );
}
