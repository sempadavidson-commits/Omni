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
  Sliders
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

const DRAFT_STORAGE_KEY = 'omni_creator_draft_v1';

const SUGGESTED_TAGS = ['#omni', '#creative', '#motion', '#cinematic', '#pulse', '#sound', '#story'];

interface DraftData {
  mediaUrl: string | null;
  mediaType: 'video' | 'image';
  mediaFileName: string;
  caption: string;
  visibility: 'public' | 'followers' | 'private';
  allowComments: boolean;
  selectedTags: string[];
  step: 'select' | 'details';
  updatedAt: string;
}

export function Create() {
  const navigate = useNavigate();
  const { currentUser, requireAuth, dispatchEvent } = useAppContext();

  // Workflow steps: 'select' | 'details'
  const [step, setStep] = useState<'select' | 'details'>('select');

  // Media state
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Live Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Details state
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Upload/Publish lifecycle states
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Preview video playback
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);

  // Draft prompt
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check existing draft on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed: DraftData = JSON.parse(saved);
        if (parsed.caption || parsed.mediaUrl) {
          setDraftPrompt(true);
        }
      }
    } catch {}
  }, []);

  // Auto-save draft changes
  useEffect(() => {
    if (mediaUrl || caption.trim()) {
      setHasUnsavedDraft(true);
      const draft: DraftData = {
        mediaUrl,
        mediaType,
        mediaFileName,
        caption,
        visibility,
        allowComments,
        selectedTags,
        step,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {}
    }
  }, [mediaUrl, mediaType, mediaFileName, caption, visibility, allowComments, selectedTags, step]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (activeXhrRef.current) {
        activeXhrRef.current.abort();
      }
    };
  }, []);

  // Bind live camera stream to video element whenever active
  useEffect(() => {
    if (isCameraActive && videoLiveRef.current && videoStreamRef.current) {
      const videoEl = videoLiveRef.current;
      videoEl.srcObject = videoStreamRef.current;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch(err => console.warn('Live preview play error:', err));
      };
      videoEl.play().catch(err => console.warn('Live preview play error:', err));
    }
  }, [isCameraActive]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed: DraftData = JSON.parse(saved);
        if (parsed.mediaUrl) setMediaUrl(parsed.mediaUrl);
        if (parsed.mediaType) setMediaType(parsed.mediaType);
        if (parsed.mediaFileName) setMediaFileName(parsed.mediaFileName);
        if (parsed.caption) setCaption(parsed.caption);
        if (parsed.visibility) setVisibility(parsed.visibility);
        if (parsed.allowComments !== undefined) setAllowComments(parsed.allowComments);
        if (parsed.selectedTags) setSelectedTags(parsed.selectedTags);
        if (parsed.step) setStep(parsed.step);
      }
    } catch {}
    setDraftPrompt(false);
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setMediaUrl(null);
    setCaption('');
    setSelectedTags([]);
    setStep('select');
    setDraftPrompt(false);
    setHasUnsavedDraft(false);
  };

  const stopCameraStream = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
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
        setCameraError('Camera API is not accessible in this browser or iframe environment.');
        return;
      }
      
      // Stop prior tracks if active
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true
      });
      videoStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera and microphone access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera/microphone found on this device.');
      } else {
        setCameraError(err.message || 'Camera permission denied or camera device unavailable.');
      }
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
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaUrl(e.target?.result as string);
          setMediaType('video');
          setMediaFileName(`omni_camera_${Date.now()}.webm`);
          stopCameraStream();
          setStep('details');
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      const interval = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 60) {
            stopRecording();
            clearInterval(interval);
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e: any) {
      setCameraError('Media recording is not supported on this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      alert('File size exceeds the 40MB limit for web video upload.');
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      alert('Please select a valid video or image file.');
      return;
    }

    setMediaType(isVideo ? 'video' : 'image');
    setMediaFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaUrl(e.target?.result as string);
      stopCameraStream();
      setStep('details');
    };
    reader.readAsDataURL(file);
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
      setSelectedTags(prev => prev.filter(t => t !== tag));
      setCaption(prev => prev.replace(tag, '').trim());
    } else {
      setSelectedTags(prev => [...prev, tag]);
      setCaption(prev => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const cancelUpload = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setIsPublishing(false);
    setUploadProgress(0);
    setPublishError('Upload was cancelled.');
  };

  const handlePublish = async () => {
    requireAuth('Publish Post', 'Sign in to share your post on Omni.', async () => {
      if (!mediaUrl && !caption.trim()) {
        setPublishError('Post must have media or a caption.');
        return;
      }

      setIsPublishing(true);
      setPublishError(null);
      setUploadProgress(5);

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Authentication expired. Please sign in again.');
        }

        const payload = {
          content: mediaUrl || '',
          caption: caption.trim(),
          type: mediaType,
          visibility,
          allowComments,
          tags: selectedTags,
        };

        // Use real XMLHttpRequest to track authentic upload progress
        const xhr = new XMLHttpRequest();
        activeXhrRef.current = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(Math.max(percent, 10));
          }
        };

        xhr.onload = () => {
          activeXhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            setPublishSuccess(true);

            try {
              const createdPost = JSON.parse(xhr.responseText);
              // Dispatch local sync engine event
              dispatchEvent({
                objectId: createdPost.id,
                operation: 'CREATE',
                payload: { targetType: 'POST', data: createdPost }
              });
            } catch {}

            // Clear draft
            try {
              localStorage.removeItem(DRAFT_STORAGE_KEY);
            } catch {}

            setTimeout(() => {
              setIsPublishing(false);
              navigate('/');
            }, 600);
          } else {
            let errorMsg = 'Failed to publish post';
            try {
              const err = JSON.parse(xhr.responseText);
              errorMsg = err.error || errorMsg;
            } catch {}
            setPublishError(errorMsg);
            setIsPublishing(false);
          }
        };

        xhr.onerror = () => {
          activeXhrRef.current = null;
          setPublishError('Network error during upload. Please check your connection and retry.');
          setIsPublishing(false);
        };

        xhr.open('POST', '/api/posts');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(JSON.stringify(payload));
      } catch (err: any) {
        setPublishError(err.message || 'An unexpected error occurred during publish.');
        setIsPublishing(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#07080c] text-white relative z-30 pb-16 overflow-hidden">
      {/* Draft Notification Banner */}
      {draftPrompt && (
        <div className="absolute top-14 left-4 right-4 z-40 p-3 rounded-2xl bg-[#0f1118]/95   shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <BookmarkPlus size={18} className="text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-200">
              Resume your unfinished draft?
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={restoreDraft}
              className="px-3 py-1 rounded-xl bg-cyan-400 text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all"
            >
              Resume
            </button>
            <button
              onClick={discardDraft}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-14 px-4 pt-safe flex items-center justify-between border-b  bg-[#07080c]/80  shrink-0">
        <button
          onClick={() => {
            if (step === 'details') {
              setStep('select');
            } else {
              navigate('/');
            }
          }}
          aria-label="Back"
          className="p-2 -ml-2 rounded-full hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors"
        >
          <X size={22} />
        </button>

        <h1 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
          {step === 'select' ? 'Select Media' : 'Post Details'}
        </h1>

        <div className="w-16 flex justify-end">
          {step === 'details' && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-3.5 py-1.5 rounded-full bg-cyan-400 text-black font-extrabold text-xs hover:bg-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)] disabled:opacity-50 flex items-center gap-1.5"
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col justify-start">
        {step === 'select' ? (
          <div className="flex flex-col gap-5 max-w-md mx-auto w-full">
            {/* Live Camera Viewport (If active) */}
            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[460px] shadow-2xl flex flex-col items-center justify-end p-4">
                <video
                  ref={videoLiveRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />

                {isRecording && (
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-red-600/90 text-white font-mono text-xs flex items-center gap-2 animate-pulse shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </div>
                )}

                <div className="relative z-10 flex items-center justify-center gap-6 mb-2">
                  <button
                    onClick={stopCameraStream}
                    className="p-3 rounded-full bg-black/60 text-white border-white/20 hover:bg-black/80 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      "w-16 h-16 rounded-full border-4 flex items-center justify-center transition-transform active:scale-95 shadow-xl",
                      isRecording
                        ? "border-white bg-red-600"
                        : "border-cyan-400 bg-cyan-400/20 hover:scale-105"
                    )}
                  >
                    <div
                      className={cn(
                        "transition-all",
                        isRecording ? "w-6 h-6 rounded-sm bg-white" : "w-12 h-12 rounded-full bg-cyan-400"
                      )}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Drag and drop / File Upload Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer select-none",
                    isDragOver
                      ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
                      : " hover:border-cyan-400/50 hover:bg-white/[0.02]"
                  )}
                >
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10  flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                    <UploadCloud size={32} />
                  </div>

                  <div className="text-center">
                    <p className="font-bold text-base text-white">Select video or photo to upload</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Drag and drop files here, or tap to browse
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Video size={13} /> MP4, WebM
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ImageIcon size={13} /> JPG, PNG
                    </span>
                    <span>•</span>
                    <span>Up to 40MB</span>
                  </div>

                  <button
                    type="button"
                    className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    Select File
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>

                {/* Real Hardware Camera trigger */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08]  text-white font-semibold text-sm transition-all active:scale-95 group shadow-lg"
                >
                  <Camera size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  Record with Camera
                </button>

                {cameraError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Step 2: Post Details & Preview */
          <div className="flex flex-col gap-5 max-w-md mx-auto w-full pb-10">
            {/* Upload Progress & Cancellation Modal/Bar */}
            {isPublishing && (
              <div className="p-4 rounded-2xl bg-cyan-500/10  flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <RefreshCw size={14} className="animate-spin" /> Uploading media...
                  </span>
                  <span className="font-mono text-white font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-150 shadow-[0_0_10px_#00f0ff]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <button
                  onClick={cancelUpload}
                  className="text-xs text-rose-400 hover:text-rose-300 self-end mt-1 font-semibold"
                >
                  Cancel Upload
                </button>
              </div>
            )}

            {publishError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{publishError}</span>
                </div>
                <button
                  onClick={handlePublish}
                  className="px-3 py-1 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-400 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {publishSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check size={16} className="shrink-0" />
                <span>Post published successfully! Redirecting to feed...</span>
              </div>
            )}

            {/* Media Preview Card */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[360px]  shadow-2xl flex items-center justify-center group">
              {mediaType === 'video' ? (
                <>
                  <video
                    ref={previewVideoRef}
                    src={mediaUrl || ''}
                    className="w-full h-full object-cover"
                    loop
                    playsInline
                    autoPlay
                    muted
                  />
                  <button
                    onClick={() => {
                      if (!previewVideoRef.current) return;
                      if (previewVideoRef.current.paused) {
                        previewVideoRef.current.play();
                        setIsPreviewPlaying(true);
                      } else {
                        previewVideoRef.current.pause();
                        setIsPreviewPlaying(false);
                      }
                    }}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isPreviewPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                  </button>
                </>
              ) : (
                <img
                  src={mediaUrl || ''}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Change Media Button */}
              <button
                onClick={() => setStep('select')}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80   text-xs font-semibold text-white transition-colors"
              >
                Change
              </button>
            </div>

            {/* Caption Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Caption & Thoughts</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's happening? Add tags, description, or story..."
                maxLength={300}
                rows={3}
                className="w-full rounded-2xl bg-[#0f1118]  p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none transition-colors"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 px-1">
                <span>{caption.length}/300</span>
              </div>
            </div>

            {/* Suggested Tags */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400">Suggested Hashtags</label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 border",
                        active
                          ? "bg-cyan-500/20  text-cyan-300"
                          : "bg-white/[0.03]  text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <Hash size={12} />
                      {tag.replace('#', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings & Permissions */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-[#0f1118] ">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Globe size={16} className="text-cyan-400" />
                  <span>Who can view</span>
                </div>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="bg-[#171a24]  rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="h-px bg-white/[0.05]" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <MessageSquare size={16} className="text-cyan-400" />
                  <span>Allow comments</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowComments(!allowComments)}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative p-0.5",
                    allowComments ? "bg-cyan-400" : "bg-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full bg-black transition-transform",
                      allowComments ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Discard Draft Button */}
            {hasUnsavedDraft && (
              <button
                type="button"
                onClick={discardDraft}
                className="self-center flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition-colors py-2"
              >
                <Trash2 size={14} /> Discard Draft
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
