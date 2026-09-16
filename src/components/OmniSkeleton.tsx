import React from 'react';
import { cn } from '../lib/utils';

interface OmniSkeletonProps {
  className?: string;
}

export function OmniSkeleton({ className }: OmniSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/[0.04] border border-white/[0.03]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent",
        className
      )}
    />
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="relative w-full h-full bg-[#07080c] flex flex-col justify-between p-4 overflow-hidden select-none">
      {/* Top Header Placeholder */}
      <div className="flex items-center justify-between pt-safe z-10 w-full">
        <div className="flex items-center gap-4 mx-auto">
          <OmniSkeleton className="w-16 h-6 rounded-full" />
          <OmniSkeleton className="w-20 h-7 rounded-full bg-cyan-500/10 border-cyan-500/20" />
        </div>
      </div>

      {/* Center ambient backdrop pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl animate-pulse" />
      </div>

      {/* Right Action Rail Placeholder */}
      <div className="absolute right-3.5 bottom-24 flex flex-col items-center gap-4 z-10">
        {/* Author Avatar Pill */}
        <div className="relative mb-2">
          <OmniSkeleton className="w-11 h-11 rounded-full ring-2 ring-white/10" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-400/30 animate-pulse" />
        </div>
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <OmniSkeleton className="w-10 h-10 rounded-full" />
          <OmniSkeleton className="w-6 h-2.5 rounded-full" />
        </div>
        {/* Comment */}
        <div className="flex flex-col items-center gap-1">
          <OmniSkeleton className="w-10 h-10 rounded-full" />
          <OmniSkeleton className="w-6 h-2.5 rounded-full" />
        </div>
        {/* Bookmark */}
        <div className="flex flex-col items-center gap-1">
          <OmniSkeleton className="w-10 h-10 rounded-full" />
          <OmniSkeleton className="w-6 h-2.5 rounded-full" />
        </div>
        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <OmniSkeleton className="w-10 h-10 rounded-full" />
          <OmniSkeleton className="w-6 h-2.5 rounded-full" />
        </div>
        {/* Audio disc */}
        <OmniSkeleton className="w-10 h-10 rounded-full mt-1 bg-white/10" />
      </div>

      {/* Bottom Metadata Placeholder */}
      <div className="z-10 pb-16 max-w-[78%] space-y-2.5">
        <div className="flex items-center gap-2">
          <OmniSkeleton className="w-7 h-7 rounded-full" />
          <OmniSkeleton className="w-28 h-4 rounded-md" />
          <OmniSkeleton className="w-12 h-4 rounded-full bg-cyan-500/10" />
        </div>
        <OmniSkeleton className="w-full h-3.5 rounded-md" />
        <OmniSkeleton className="w-4/5 h-3.5 rounded-md" />
        <div className="flex items-center gap-2 pt-1">
          <OmniSkeleton className="w-4 h-4 rounded-full" />
          <OmniSkeleton className="w-36 h-3 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[9/16] bg-white/[0.03] rounded-lg overflow-hidden relative border border-white/[0.04]"
        >
          <OmniSkeleton className="w-full h-full rounded-none" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-7 h-2 rounded bg-white/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white select-none overflow-y-auto hide-scrollbar">
      {/* Top Header Placeholder */}
      <div className="pt-safe px-4 py-3 flex items-center justify-between bg-[#07080c] border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <OmniSkeleton className="w-8 h-8 rounded-full" />
          <OmniSkeleton className="w-8 h-8 rounded-full" />
        </div>
        <OmniSkeleton className="w-28 h-5 rounded-md" />
        <OmniSkeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Main Profile Info Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <OmniSkeleton className="w-20 h-20 rounded-full ring-2 ring-white/10" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500/20 animate-pulse" />
          </div>

          {/* User Details */}
          <div className="flex-1 space-y-2 pt-1">
            <OmniSkeleton className="w-32 h-5 rounded-md bg-cyan-500/10" />
            <OmniSkeleton className="w-24 h-3.5 rounded-md" />
            <div className="flex items-center gap-2 pt-1">
              <OmniSkeleton className="w-24 h-7 rounded-xl" />
              <OmniSkeleton className="w-24 h-7 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5 pt-1">
          <OmniSkeleton className="w-full h-3.5 rounded-md" />
          <OmniSkeleton className="w-3/4 h-3.5 rounded-md" />
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-4 gap-2 bg-white/[0.02] py-2.5 px-2 rounded-2xl border border-white/[0.03]">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center gap-1">
              <OmniSkeleton className="w-10 h-2 rounded" />
              <OmniSkeleton className="w-8 h-4 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="flex items-center border-b border-white/[0.06] bg-[#07080c] px-4 py-2.5 gap-6 justify-around">
        <OmniSkeleton className="w-16 h-4 rounded-full bg-cyan-500/20" />
        <OmniSkeleton className="w-16 h-4 rounded-full" />
        <OmniSkeleton className="w-16 h-4 rounded-full" />
      </div>

      {/* Video Grid Skeletons */}
      <VideoGridSkeleton count={9} />
    </div>
  );
}
