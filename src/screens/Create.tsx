import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  UploadCloud,
  Video,
  Image as ImageIcon,
  Camera,
  Play,
  Pause,
  Globe,
  Lock,
  Users,
  MessageSquare,
  Check,
  AlertCircle,
  Hash,
  BookmarkPlus,
  RefreshCw,
  Trash2,
  Sliders,
  Scissors,
  Crop,
  Type,
  RotateCcw,
  FlipHorizontal,
  Clock,
  Palette,
  Layers,
  Move,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

const DRAFT_STORAGE_KEY = 'omni_creator_draft_v2';
const SUGGESTED_TAGS = ['#omni', '#creative', '#cinematic', '#motion', '#sound', '#story', '#trending'];

const DURATION_OPTIONS = [
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
];

const CAMERA_BEAUTY_FILTERS = [
  { id: 'none', name: 'Natural', css: '' },
  { id: 'smooth', name: 'Velvet Smooth', css: 'brightness(1.08) contrast(1.03) saturate(1.12)' },
  { id: 'glow', name: 'Radiant Glow', css: 'brightness(1.15) contrast(0.98) saturate(1.2)' },
  { id: 'warm', name: 'Golden Hour', css: 'sepia(0.2) saturate(1.3) contrast(1.08)' },
  { id: 'cyber', name: 'Cyber Neon', css: 'hue-rotate(20deg) contrast(1.25) saturate(1.4)' },
  { id: 'noir', name: 'Studio Noir', css: 'grayscale(1) contrast(1.35)' },
];

const PRO_FILTERS = [
  { id: 'normal', name: 'Original', css: '' },
  { id: 'teal_orange', name: 'Teal & Orange', css: 'contrast(1.2) saturate(1.35) hue-rotate(-10deg)' },
  { id: 'cyberpunk', name: 'Cyberpunk 2099', css: 'contrast(1.3) saturate(1.6) hue-rotate(15deg)' },
  { id: 'vintage35', name: '35mm Film Grain', css: 'sepia(0.35) saturate(1.2) contrast(1.15)' },
  { id: 'noir_pro', name: 'High-Key Noir', css: 'grayscale(1) contrast(1.4) brightness(0.95)' },
  { id: 'radiant_soft', name: 'Radiant Soft', css: 'brightness(1.12) contrast(0.95) saturate(1.25)' },
  { id: 'fuji_green', name: 'Emerald Velvet', css: 'hue-rotate(60deg) contrast(1.1) saturate(1.2)' },
];

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16 Vertical', class: 'aspect-[9/16]' },
  { id: '1:1', label: '1:1 Square', class: 'aspect-square' },
  { id: '4:5', label: '4:5 Portrait', class: 'aspect-[4/5]' },
  { id: '16:9', label: '16:9 Wide', class: 'aspect-[16/9]' },
];

const TEXT_BACKGROUNDS = [
  { id: 'glass', name: 'Dark Glass', bgClass: 'bg-black/70 backdrop-blur-md border border-white/20 text-white' },
  { id: 'cyan_neon', name: 'Cyber Cyan', bgClass: 'bg-cyan-400 text-black font-black shadow-[0_0_15px_rgba(0,240,255,0.6)]' },
  { id: 'crimson', name: 'Neon Rose', bgClass: 'bg-rose-600 text-white font-black shadow-[0_0_15px_rgba(244,63,94,0.6)]' },
  { id: 'amethyst', name: 'Amethyst Purple', bgClass: 'bg-purple-600 text-white font-bold shadow-md' },
  { id: 'solid_white', name: 'Clean White', bgClass: 'bg-white text-black font-bold' },
  { id: 'outline', name: 'Transparent Shadow', bgClass: 'bg-transparent text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]' },
];

const TEXT_POSITIONS = [
  { id: 'top', label: 'Top', posClass: 'top-8 left-1/2 -translate-x-1/2' },
  { id: 'center', label: 'Center', posClass: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { id: 'bottom', label: 'Bottom', posClass: 'bottom-12 left-1/2 -translate-x-1/2' },
];

export function Create() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, requireAuth, dispatchEvent, startBackgroundUpload } = useAppContext();

  // Workflow step: 'select' | 'edit' | 'details'
  const [step, setStep] = useState<'select' | 'edit' | 'details'>('select');

  // Media state
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<Blob | File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [mediaDuration, setMediaDuration] = useState<number>(10);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (location.state?.draftMediaUrl) {
      setMediaUrl(location.state.draftMediaUrl);
      setMediaType(location.state.draftType || 'video');
      if (location.state.draftCaption) {
        setCaption(location.state.draftCaption);
      }
      setStep('edit');
    }
  }, [location.state]);

  // Time & Recording Limit
  const [selectedDurationLimit, setSelectedDurationLimit] = useState<number>(60);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraBeautyFilter, setCameraBeautyFilter] = useState('smooth');

  // Live Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Video Editing tools
  const [activeFilter, setActiveFilter] = useState('normal');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [currentTimeScrub, setCurrentTimeScrub] = useState(0);

  // Overlay text tools (user decided background & position)
  const [overlayText, setOverlayText] = useState('');
  const [textBackgroundId, setTextBackgroundId] = useState('glass');
  const [textPositionId, setTextPositionId] = useState('center');
  const [activeEditTab, setActiveEditTab] = useState<'filter' | 'trim' | 'crop' | 'text'>('filter');

  // Details state
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Publish lifecycle
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Video preview player & audio control
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live video trimming loop control
  useEffect(() => {
    if (step !== 'edit' || mediaType !== 'video') return;
    const video = previewVideoRef.current;
    if (!video) return;

    const dur = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 10;
    const startSec = (trimStart / 100) * dur;
    const endSec = (trimEnd / 100) * dur;

    const handleTimeUpdate = () => {
      if (video.currentTime >= endSec || video.currentTime < startSec - 0.2) {
        video.currentTime = startSec;
        video.play().catch(() => {});
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [step, mediaType, trimStart, trimEnd, mediaDuration]);

  // Scrub start boundary with live sound preview
  const handleTrimStartScrub = (value: number) => {
    setTrimStart(value);
    const dur = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 10;
    const startTimeSec = (value / 100) * dur;
    if (previewVideoRef.current) {
      const video = previewVideoRef.current;
      video.muted = false;
      setIsSoundEnabled(true);
      video.currentTime = startTimeSec;
      video.play().catch(() => {});
    }
  };

  // Scrub end boundary with live sound preview
  const handleTrimEndScrub = (value: number) => {
    setTrimEnd(value);
    const dur = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 10;
    const endTimeSec = (value / 100) * dur;
    if (previewVideoRef.current) {
      const video = previewVideoRef.current;
      video.muted = false;
      setIsSoundEnabled(true);
      // Position 1.5s before end boundary so user hears the lively lead-in to the cut
      video.currentTime = Math.max(0, endTimeSec - 1.5);
      video.play().catch(() => {});
    }
  };

  const previewStartCutSound = () => {
    const dur = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 10;
    const startTimeSec = (trimStart / 100) * dur;
    if (previewVideoRef.current) {
      const video = previewVideoRef.current;
      video.muted = false;
      setIsSoundEnabled(true);
      video.currentTime = startTimeSec;
      video.play().catch(() => {});
    }
  };

  const previewEndCutSound = () => {
    const dur = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 10;
    const endTimeSec = (trimEnd / 100) * dur;
    if (previewVideoRef.current) {
      const video = previewVideoRef.current;
      video.muted = false;
      setIsSoundEnabled(true);
      video.currentTime = Math.max(0, endTimeSec - 2.0);
      video.play().catch(() => {});
    }
  };

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (activeXhrRef.current) activeXhrRef.current.abort();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Bind live camera stream
  useEffect(() => {
    if (isCameraActive && videoLiveRef.current && videoStreamRef.current) {
      videoLiveRef.current.srcObject = videoStreamRef.current;
      videoLiveRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const stopCameraStream = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (videoLiveRef.current) {
      videoLiveRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this environment.');
        return;
      }

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      videoStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera device not accessible or permission declined.');
    }
  };

  const flipCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      stopCameraStream();
      setTimeout(() => startCamera(), 100);
    }
  };

  const startRecording = () => {
    if (!videoStreamRef.current) return;
    recordedChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(videoStreamRef.current, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `capture_${Date.now()}.webm`, { type: 'video/webm' });
        setMediaFile(file);
        if (mediaUrl && mediaUrl.startsWith('blob:')) {
          URL.revokeObjectURL(mediaUrl);
        }
        const objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
        setMediaType('video');
        setMediaFileName(file.name);
        stopCameraStream();
        setStep('edit');
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= selectedDurationLimit) {
            stopRecording();
            return selectedDurationLimit;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e) {
      setCameraError('Media recording is not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert('Please select a valid video or image file.');
      return;
    }

    setMediaType(isVideo ? 'video' : 'image');
    setMediaFileName(file.name);
    setMediaFile(file);

    if (mediaUrl && mediaUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setMediaUrl(objectUrl);
    stopCameraStream();
    setStep('edit');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
      setCaption((prev) => prev.replace(tag, '').trim());
    } else {
      setSelectedTags((prev) => [...prev, tag]);
      setCaption((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const handlePublish = async () => {
    requireAuth('Publish Post', 'Sign in to share your post on Nexus.', async () => {
      if (!mediaUrl && !caption.trim()) {
        setPublishError('Post must have media or a caption.');
        return;
      }

      setIsPublishing(true);
      setPublishError(null);

      try {
        await startBackgroundUpload({
          file: mediaFile,
          mediaUrl: mediaUrl || undefined,
          mediaType,
          caption: caption.trim(),
          tags: selectedTags,
          visibility,
          allowComments,
        });

        // Clean up draft
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {}
      } catch (err: any) {
        setPublishError(err.message || 'An unexpected error occurred during publish.');
        setIsPublishing(false);
      }
    });
  };

  const selectedFilterObj = PRO_FILTERS.find((f) => f.id === activeFilter);
  const selectedRatioObj = ASPECT_RATIOS.find((r) => r.id === aspectRatio);
  const selectedTextBg = TEXT_BACKGROUNDS.find((b) => b.id === textBackgroundId);
  const selectedTextPos = TEXT_POSITIONS.find((p) => p.id === textPositionId);
  const activeCameraBeautyCss = CAMERA_BEAUTY_FILTERS.find((bf) => bf.id === cameraBeautyFilter)?.css || '';

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white relative z-30 pb-16 overflow-hidden">
      {/* Top Navigation Header */}
      <header className="h-14 px-4 pt-safe flex items-center justify-between border-b border-white/[0.06] bg-[#07080c]/90 shrink-0">
        <button
          onClick={() => {
            if (step === 'details') setStep('edit');
            else if (step === 'edit') setStep('select');
            else navigate('/');
          }}
          aria-label="Back"
          className="p-2 -ml-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors"
        >
          <X size={22} />
        </button>

        <h1 className="text-sm font-extrabold tracking-wider text-slate-200 uppercase">
          {step === 'select' ? 'Capture & Upload' : step === 'edit' ? 'Studio Editor' : 'Post Details'}
        </h1>

        <div className="w-16 flex justify-end">
          {step === 'edit' && (
            <button
              onClick={() => setStep('details')}
              className="px-4 py-1.5 rounded-full bg-cyan-400 text-black font-black text-xs hover:bg-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            >
              Next
            </button>
          )}
          {step === 'details' && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-1.5 rounded-full bg-cyan-400 text-black font-black text-xs hover:bg-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)] disabled:opacity-50 flex items-center gap-1.5"
            >
              {isPublishing ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  {uploadProgress}%
                </>
              ) : (
                'Post'
              )}
            </button>
          )}
        </div>
      </header>

      {/* STEP 1: Select Media / Hardware Camera with Beauty Filter */}
      {step === 'select' && (
        <main className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col justify-start max-w-md mx-auto w-full gap-4">
          {/* Duration Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Clock size={13} className="text-cyan-400" /> Max Recording Limit:
              </span>
              <span className="font-bold text-cyan-400">
                {DURATION_OPTIONS.find((d) => d.seconds === selectedDurationLimit)?.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  onClick={() => setSelectedDurationLimit(opt.seconds)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                    selectedDurationLimit === opt.seconds
                      ? 'bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      : 'bg-white/[0.05] text-slate-300 hover:bg-white/10'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Camera Viewport */}
          {isCameraActive ? (
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-[9/16] max-h-[520px] shadow-2xl flex flex-col justify-between p-4 border border-white/10">
              <video
                ref={videoLiveRef}
                autoPlay
                playsInline
                muted
                style={{ filter: activeCameraBeautyCss }}
                className="absolute inset-0 w-full h-full object-cover z-0"
              />

              {/* Camera Header */}
              <div className="relative z-10 w-full flex items-center justify-between">
                {isRecording ? (
                  <div className="px-3 py-1 rounded-full bg-rose-600 text-white font-mono text-xs flex items-center gap-2 animate-pulse shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    {Math.floor(recordingSeconds / 60)}:
                    {(recordingSeconds % 60).toString().padStart(2, '0')} /{' '}
                    {DURATION_OPTIONS.find((d) => d.seconds === selectedDurationLimit)?.label}
                  </div>
                ) : (
                  <span className="text-xs text-white/90 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                    Live Recording
                  </span>
                )}

                <button
                  onClick={flipCamera}
                  className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-colors"
                  title="Flip camera"
                >
                  <FlipHorizontal size={18} />
                </button>
              </div>

              {/* Live Beauty Filters Selection Bar */}
              <div className="relative z-10 w-full space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-white/90 flex items-center gap-1 drop-shadow-md">
                  <Palette size={11} className="text-cyan-400" /> Beauty Filter
                </span>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1">
                  {CAMERA_BEAUTY_FILTERS.map((bf) => (
                    <button
                      key={bf.id}
                      onClick={() => setCameraBeautyFilter(bf.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap backdrop-blur-md border transition-all',
                        cameraBeautyFilter === bf.id
                          ? 'border-cyan-400 bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                          : 'border-white/20 bg-black/60 text-slate-200'
                      )}
                    >
                      {bf.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Record Action */}
              <div className="relative z-10 flex items-center justify-center gap-6 mb-2">
                <button
                  onClick={stopCameraStream}
                  className="px-4 py-2 rounded-full bg-black/60 text-white text-xs font-semibold hover:bg-black/80 transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    'w-16 h-16 rounded-full border-4 flex items-center justify-center transition-transform active:scale-95 shadow-2xl',
                    isRecording ? 'border-white bg-rose-600' : 'border-cyan-400 bg-cyan-400/20 hover:scale-105'
                  )}
                >
                  <div
                    className={cn(
                      'transition-all',
                      isRecording ? 'w-6 h-6 rounded-sm bg-white' : 'w-12 h-12 rounded-full bg-cyan-400'
                    )}
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Drag and Drop Upload Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer select-none bg-[#0e111a]/60',
                  isDragOver
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                    : 'border-white/[0.08] hover:border-cyan-400/50 hover:bg-white/[0.02]'
                )}
              >
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                  <UploadCloud size={32} />
                </div>

                <div className="text-center">
                  <p className="font-bold text-base text-white">Select video or photo</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports any video, photo, or animation format
                  </p>
                  <p className="text-[11px] text-cyan-400 mt-0.5">High definition & ultra quality</p>
                </div>

                <button
                  type="button"
                  className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  Browse Files
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {/* Hardware Camera Trigger */}
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white font-bold text-sm transition-all active:scale-95 group shadow-lg"
              >
                <Camera size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Open Camera & Record</span>
              </button>
            </>
          )}

          {cameraError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </main>
      )}

      {/* STEP 2: Studio Video Editor (Professional Trimming, LUT Filters, Overlay Text with Backgrounds) */}
      {step === 'edit' && mediaUrl && (
        <main className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col items-center justify-start max-w-md mx-auto w-full gap-4">
          {/* Media Canvas Stage */}
          <div
            className={cn(
              'relative rounded-3xl overflow-hidden bg-black shadow-2xl w-full max-h-[360px] flex items-center justify-center border border-white/10',
              selectedRatioObj?.class
            )}
          >
            {mediaType === 'video' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={previewVideoRef}
                  src={mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  muted={!isSoundEnabled}
                  style={{ filter: selectedFilterObj?.css }}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    const dur = video.duration;
                    if (dur && Number.isFinite(dur) && dur > 0) {
                      setMediaDuration(dur);
                    } else {
                      setMediaDuration(10);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className="absolute bottom-3 right-3 p-2 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-full text-white z-30 transition-all border border-white/20 shadow-lg flex items-center gap-1.5 px-2.5 py-1 text-xs"
                  title="Toggle preview sound"
                >
                  {isSoundEnabled ? (
                    <>
                      <Volume2 size={14} className="text-cyan-400" />
                      <span className="text-[11px] font-semibold text-cyan-300">Sound ON</span>
                    </>
                  ) : (
                    <>
                      <VolumeX size={14} className="text-slate-400" />
                      <span className="text-[11px] font-semibold text-slate-400">Muted</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt="Upload preview"
                style={{ filter: selectedFilterObj?.css }}
                className="w-full h-full object-cover"
              />
            )}

            {/* Rendered Text Overlay with User-Selected Background and Position */}
            {overlayText.trim() && (
              <div
                className={cn(
                  'absolute px-4 py-2 rounded-2xl text-center text-sm sm:text-base transition-all max-w-[85%] z-20',
                  selectedTextBg?.bgClass,
                  selectedTextPos?.posClass
                )}
              >
                {overlayText}
              </div>
            )}
          </div>

          {/* Editor Module Selector Tabs */}
          <div className="flex bg-white/[0.05] p-1 rounded-2xl border border-white/[0.06] w-full justify-between">
            <button
              onClick={() => setActiveEditTab('filter')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                activeEditTab === 'filter' ? 'bg-cyan-400 text-black shadow' : 'text-slate-400 hover:text-white'
              )}
            >
              <Palette size={14} /> Color LUT
            </button>
            <button
              onClick={() => setActiveEditTab('trim')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                activeEditTab === 'trim' ? 'bg-cyan-400 text-black shadow' : 'text-slate-400 hover:text-white'
              )}
            >
              <Scissors size={14} /> Trim & Speed
            </button>
            <button
              onClick={() => setActiveEditTab('text')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                activeEditTab === 'text' ? 'bg-cyan-400 text-black shadow' : 'text-slate-400 hover:text-white'
              )}
            >
              <Type size={14} /> Overlay Text
            </button>
            <button
              onClick={() => setActiveEditTab('crop')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                activeEditTab === 'crop' ? 'bg-cyan-400 text-black shadow' : 'text-slate-400 hover:text-white'
              )}
            >
              <Crop size={14} /> Keyframe & Aspect
            </button>
          </div>

          {/* Module 1: Color LUT Grading Filters */}
          {activeEditTab === 'filter' && (
            <div className="w-full flex gap-2.5 overflow-x-auto hide-scrollbar py-2">
              {PRO_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all shrink-0 w-24',
                    activeFilter === f.id
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/[0.06] bg-white/[0.03] hover:border-white/20'
                  )}
                >
                  <div
                    style={{ filter: f.css }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-md"
                  />
                  <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Module 2: Precision Video Trimming Bar with Live Sound Preview */}
          {activeEditTab === 'trim' && (
            <div className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                <span className="text-cyan-400 flex items-center gap-1">
                  Start: {(((trimStart / 100) * (Number.isFinite(mediaDuration) ? mediaDuration : 10)) || 0).toFixed(1)}s
                </span>
                <span className="text-slate-400">
                  Duration: {((((trimEnd - trimStart) / 100) * (Number.isFinite(mediaDuration) ? mediaDuration : 10)) || 0).toFixed(1)}s
                </span>
                <span className="text-indigo-400 flex items-center gap-1">
                  End: {(((trimEnd / 100) * (Number.isFinite(mediaDuration) ? mediaDuration : 10)) || 0).toFixed(1)}s
                </span>
              </div>

              {/* Multi-track Trimming scrubber with Live Sound Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-400 font-semibold w-10">Start:</span>
                  <input
                    type="range"
                    min={0}
                    max={trimEnd - 5}
                    value={trimStart}
                    onChange={(e) => handleTrimStartScrub(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-400 font-semibold w-10">End:</span>
                  <input
                    type="range"
                    min={trimStart + 5}
                    max={100}
                    value={trimEnd}
                    onChange={(e) => handleTrimEndScrub(Number(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Sound Preview Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={previewStartCutSound}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl text-cyan-300 text-[11px] font-semibold transition-all"
                >
                  <Volume2 size={13} />
                  <span>Preview Start Cut</span>
                </button>
                <button
                  type="button"
                  onClick={previewEndCutSound}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-xl text-indigo-300 text-[11px] font-semibold transition-all"
                >
                  <Volume2 size={13} />
                  <span>Preview End Cut</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center bg-white/[0.02] py-1 px-2 rounded-lg border border-white/5">
                <Volume2 size={11} className="text-cyan-400" />
                <span>Pulling sliders lively previews the start & end point with sound in real-time</span>
              </div>
            </div>
          )}

          {/* Module 3: Overlay Text with User-Decided Backgrounds & Position */}
          {activeEditTab === 'text' && (
            <div className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-3.5">
              <input
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder="Enter overlay text to display on media..."
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-cyan-400/50"
              />

              {/* Background Style Selector */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Palette size={12} className="text-cyan-400" /> Text Background Style
                </span>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1">
                  {TEXT_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setTextBackgroundId(bg.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border',
                        textBackgroundId === bg.id
                          ? 'border-cyan-400 bg-cyan-400 text-black shadow-sm'
                          : 'border-white/10 bg-white/[0.04] text-slate-300'
                      )}
                    >
                      {bg.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Position Selector */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Move size={12} className="text-cyan-400" /> Position
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {TEXT_POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setTextPositionId(pos.id)}
                      className={cn(
                        'py-1.5 rounded-xl text-xs font-bold transition-all border text-center',
                        textPositionId === pos.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-400'
                      )}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {overlayText && (
                <button
                  onClick={() => setOverlayText('')}
                  className="text-xs text-rose-400 self-end hover:underline font-semibold"
                >
                  Clear Overlay Text
                </button>
              )}
            </div>
          )}

          {/* Module 4: Aspect Ratio */}
          {activeEditTab === 'crop' && (
            <div className="w-full grid grid-cols-4 gap-2 py-2">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setAspectRatio(r.id)}
                  className={cn(
                    'p-3 rounded-2xl border text-center text-xs font-bold transition-all',
                    aspectRatio === r.id
                      ? 'border-cyan-400 bg-cyan-400 text-black shadow'
                      : 'border-white/[0.06] bg-white/[0.03] text-slate-300 hover:border-white/20'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* STEP 3: Post Details, Caption & Hashtags */}
      {step === 'details' && (
        <main className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col max-w-md mx-auto w-full gap-5">
          {/* Summary Card */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            {mediaUrl ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0">
                {mediaType === 'video' ? (
                  <video src={mediaUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={mediaUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                <Video size={24} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate block">
                {mediaFileName || 'Media Ready'}
              </span>
              <span className="text-[11px] text-cyan-400 block mt-0.5">
                Filter: {selectedFilterObj?.name} • Aspect: {aspectRatio}
              </span>
              <button
                onClick={() => setStep('edit')}
                className="text-[11px] text-slate-400 hover:text-white mt-1 underline"
              >
                Re-edit media
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Caption & Story</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write an engaging caption, story, or description... Use #hashtags"
              rows={4}
              maxLength={500}
              className="w-full bg-[#0e111a] border border-white/[0.08] rounded-2xl p-3.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/50 resize-none transition-colors"
            />
            <span className="text-[10px] text-slate-500 self-end">{caption.length}/500</span>
          </div>

          {/* Hashtags */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-400">Suggested Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    selectedTags.includes(tag)
                      ? 'bg-cyan-400 text-black font-bold shadow-sm'
                      : 'bg-white/[0.05] text-slate-300 hover:bg-white/10'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-300">Who Can View This Post</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all',
                  visibility === 'public'
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20'
                )}
              >
                <Globe size={18} />
                <span className="text-xs font-bold">Public</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('followers')}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all',
                  visibility === 'followers'
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20'
                )}
              >
                <Users size={18} />
                <span className="text-xs font-bold">Followers</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all',
                  visibility === 'private'
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20'
                )}
              >
                <Lock size={18} />
                <span className="text-xs font-bold">Only Me</span>
              </button>
            </div>
          </div>

          {/* Comments Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <MessageSquare size={18} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-200">Allow Comments</span>
            </div>
            <button
              type="button"
              onClick={() => setAllowComments(!allowComments)}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative p-0.5',
                allowComments ? 'bg-cyan-400' : 'bg-slate-700'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-black shadow transition-transform',
                  allowComments ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {publishError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{publishError}</span>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
