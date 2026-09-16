import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface AudioMessagePlayerProps {
  src: string;
  isMe?: boolean;
}

export function AudioMessagePlayer({ src, isMe = false }: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback error:', err);
        setHasError(true);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const totalSecs = Math.floor(secs);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const remainingSecs = totalSecs % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (hasError) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2.5 rounded-xl text-xs",
        isMe ? "bg-black/20 text-white" : "bg-rose-500/10 text-rose-300"
      )}>
        <AlertCircle size={16} className="shrink-0 text-rose-400" />
        <span>Audio unavailable</span>
      </div>
    );
  }

  // Generate 20 pseudo-waveform bars based on index
  const waveformHeights = [40, 65, 30, 85, 45, 90, 60, 100, 50, 75, 35, 80, 65, 95, 40, 70, 50, 85, 30, 60];

  return (
    <div className={cn(
      "flex flex-col gap-1.5 p-2.5 rounded-2xl w-64 max-w-full select-none",
      isMe ? "bg-transparent text-white" : "bg-[#181a24] text-slate-100"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play / Pause Toggle Button */}
        <button
          onClick={togglePlayPause}
          type="button"
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-md",
            isMe
              ? "bg-white text-cyan-600 hover:bg-cyan-50"
              : "bg-cyan-400 text-black hover:bg-cyan-300"
          )}
          title={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
        </button>

        {/* Waveform & Progress display */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
          <div className="relative flex items-center gap-[2px] h-6 cursor-pointer py-1">
            {waveformHeights.map((h, idx) => {
              const barPercent = ((idx + 1) / waveformHeights.length) * 100;
              const isPlayed = progressPercent >= barPercent;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (audioRef.current && duration > 0) {
                      const targetTime = (barPercent / 100) * duration;
                      audioRef.current.currentTime = targetTime;
                      setCurrentTime(targetTime);
                    }
                  }}
                  style={{ height: `${h}%` }}
                  className={cn(
                    "flex-1 rounded-full transition-colors duration-150",
                    isPlayed
                      ? isMe ? "bg-white" : "bg-cyan-400"
                      : isMe ? "bg-white/30" : "bg-white/15"
                  )}
                />
              );
            })}
          </div>

          {/* Time indicator */}
          <div className="flex items-center justify-between text-[10px] font-mono opacity-80 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Optional Range Input overlay for precise seeking */}
      <input
        type="range"
        min={0}
        max={duration || 100}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 bg-white/20 accent-cyan-400 rounded-lg cursor-pointer opacity-0 hover:opacity-100 transition-opacity -mt-1"
      />
    </div>
  );
}
