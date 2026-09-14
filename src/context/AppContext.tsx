import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SyncState, User, BackgroundUploadTask, BackgroundDownloadTask, Post } from '../types';
import { Download, Check, X } from 'lucide-react';
import { globalSyncEngine } from '../sync/sync_engine';
import { HttpTransport } from '../networking/httpTransport';
import { SocialEvent } from '../domain/event';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthAction {
  actionName: string;
  message: string;
}

interface AppContextType {
  currentUser: User | null;
  syncState: SyncState;
  isAuthModalOpen: boolean;
  authAction: AuthAction | null;
  requireAuth: (actionName: string, message: string, callback: () => void) => void;
  closeAuthModal: () => void;
  login: (userData?: Partial<User>) => void;
  logout: () => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  dispatchEvent: (event: Partial<SocialEvent>) => void;
  isGlobalMuted: boolean;
  setIsGlobalMuted: (muted: boolean) => void;
  unreadInboxCount: number;
  refreshUnreadCount: () => void;
  isInitialized: boolean;
  savedAccounts: User[];
  switchAccount: (account: User) => void;
  removeSavedAccount: (userId: string) => void;
  activeUploads: BackgroundUploadTask[];
  activeDownloads: BackgroundDownloadTask[];
  startBackgroundUpload: (upload: {
    file?: File | Blob | null;
    mediaUrl?: string;
    mediaType: 'video' | 'image' | 'text';
    caption: string;
    tags?: string[];
    visibility?: string;
    allowComments?: boolean;
  }) => Promise<void>;
  cancelUpload: (id: string) => void;
  startBackgroundDownloadVideo: (post: Post) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('GLOBAL_ONLINE');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authAction, setAuthAction] = useState<AuthAction | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeUploads, setActiveUploads] = useState<BackgroundUploadTask[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<BackgroundDownloadTask[]>([]);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const activeXhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());

  // Auto system detection of device theme (Never add custom toggle button)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      if (mediaQuery.matches) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };
    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);
  
  // Persist mute state in localStorage
  const [isGlobalMuted, setIsGlobalMutedState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('omni_muted');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const setIsGlobalMuted = (muted: boolean) => {
    setIsGlobalMutedState(muted);
    try {
      localStorage.setItem('omni_muted', String(muted));
    } catch {}
  };

  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [messageToast, setMessageToast] = useState<{
    id: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    conversationId?: string;
  } | null>(null);
  const transportRef = useRef(new HttpTransport());

  // Listen for real-time SSE messages for online toast
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_MESSAGE' && data.message) {
          const msg = data.message;
          if (currentUser && msg.senderId !== currentUser.id) {
            setUnreadInboxCount(prev => prev + 1);
            setMessageToast({
              id: msg.id || Date.now().toString(),
              senderName: msg.sender?.displayName || msg.sender?.username || 'New Message',
              senderAvatar: msg.sender?.avatar,
              text: msg.text || 'Sent media',
              conversationId: data.conversationId,
            });
            setTimeout(() => {
              setMessageToast(null);
            }, 4500);
          }
        }
      } catch (e) {}
    };
    return () => {
      eventSource.close();
    };
  }, [currentUser]);

  const refreshUnreadCount = async () => {
    if (!auth.currentUser) {
      setUnreadInboxCount(0);
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      // Check notifications
      const notifRes = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      let count = 0;
      if (notifRes.ok) {
        const notifs = await notifRes.json();
        if (Array.isArray(notifs)) {
          count += notifs.filter((n: any) => {
            if (!n) return false;
            const isRead = n.isRead ?? n.notification?.isRead ?? false;
            return !isRead;
          }).length;
        }
      }
      // Check unread conversations
      const convRes = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (convRes.ok) {
        const convs = await convRes.json();
        if (Array.isArray(convs)) {
          count += convs.reduce((acc: number, c: any) => acc + (c?.unreadCount || 0), 0);
        }
      }
      setUnreadInboxCount(count);
    } catch (e) {
      // ignore
    }
  };

  const [savedAccounts, setSavedAccounts] = useState<User[]>(() => {
    try {
      const stored = localStorage.getItem('omni_saved_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveAccountLocally = (user: User) => {
    if (!user || !user.id) return;
    setSavedAccounts(prev => {
      const filtered = prev.filter(a => a.id !== user.id && a.uid !== user.uid && a.username !== user.username);
      const updated = [user, ...filtered];
      try {
        localStorage.setItem('omni_saved_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const switchAccount = (account: User) => {
    if (!account) return;
    setCurrentUser(account);
    try {
      localStorage.setItem('omni_active_account_id', account.id);
    } catch {}
    refreshUnreadCount();
  };

  const removeSavedAccount = (userId: string) => {
    setSavedAccounts(prev => {
      const updated = prev.filter(a => a.id !== userId && a.uid !== userId);
      try {
        localStorage.setItem('omni_saved_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (currentUser?.id === userId || currentUser?.uid === userId) {
      logout();
    }
  };

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create user session locally
        const baseUser: User = {
          id: user.uid,
          uid: user.uid,
          email: user.email || undefined,
          username: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : 'user_' + user.uid.substring(0, 6),
          displayName: user.displayName || 'New User',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          followersCount: 0,
          followingCount: 0,
        };
        setCurrentUser(baseUser);
        saveAccountLocally(baseUser);
        
        // Fetch accurate DB user if possible
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.dbUser) {
            const finalUser: User = {
              ...baseUser,
              id: data.dbUser.uid || baseUser.id,
              uid: data.dbUser.uid,
              username: data.dbUser.username,
              avatar: data.dbUser.avatar,
              displayName: data.dbUser.displayName,
              bio: data.dbUser.bio,
              followersCount: data.dbUser.followersCount,
              followingCount: data.dbUser.followingCount,
              lastUsernameChangeAt: data.dbUser.lastUsernameChangeAt,
            };
            setCurrentUser(finalUser);
            saveAccountLocally(finalUser);
          }
          refreshUnreadCount();
        } catch (e) {}
      } else {
        setCurrentUser(null);
        setUnreadInboxCount(0);
      }
      // Delay slightly for smooth transition if needed, or set immediately
      setIsInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Sync Engine & Network State
  useEffect(() => {
    globalSyncEngine.registerTransport(transportRef.current);
    
    const updateNetworkStatus = () => {
      setSyncState(navigator.onLine ? 'GLOBAL_ONLINE' : 'OFFLINE');
      if (navigator.onLine) {
        transportRef.current.connect();
        globalSyncEngine.sync();
      } else {
        transportRef.current.disconnect();
      }
    };
    
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Initial sync
    updateNetworkStatus();
    
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      transportRef.current.disconnect();
    };
  }, []);

  const requireAuth = (actionName: string, message: string, callback: () => void) => {
    if (currentUser) {
      callback();
    } else {
      setAuthAction({ actionName, message });
      setPendingCallback(() => callback);
      setIsAuthModalOpen(true);
    }
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthAction(null);
    setPendingCallback(null);
  };

  const login = (userData?: Partial<User>) => {
    const id = userData?.id || auth.currentUser?.uid || 'u_' + Math.random().toString(36).substr(2, 9);
    const username = userData?.username || 'user_' + id.substring(2, 6);
    
    setCurrentUser(prev => ({
      id,
      username,
      displayName: userData?.displayName || 'New User',
      avatar: userData?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      followersCount: 0,
      followingCount: 0,
      ...userData
    }));
    
    closeAuthModal();
    if (pendingCallback) {
      setTimeout(() => {
        pendingCallback();
      }, 0);
      setPendingCallback(null);
    }
  };

  const logout = () => {
    auth.signOut();
    setCurrentUser(null);
    setUnreadInboxCount(0);
    navigate('/');
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };
  
  const dispatchEvent = (eventData: Partial<SocialEvent>) => {
    const authorId = currentUser?.id || auth.currentUser?.uid;
    if (!authorId) return;
    
    const fullEvent: SocialEvent = {
      eventId: crypto.randomUUID(),
      authorId: authorId,
      deviceId: 'web-device',
      objectId: eventData.objectId || crypto.randomUUID(),
      operation: eventData.operation || 'UPDATE',
      hlc: new Date().toISOString(),
      payload: eventData.payload || {},
      signature: 'sig_' + Math.random().toString(36).substring(7)
    };
    
    globalSyncEngine.dispatchEvent(fullEvent);
  };

  const cancelUpload = (id: string) => {
    const xhr = activeXhrsRef.current.get(id);
    if (xhr) {
      try { xhr.abort(); } catch {}
      activeXhrsRef.current.delete(id);
    }
    setActiveUploads(prev => prev.filter(u => u.id !== id));
  };

  const startBackgroundUpload = async (upload: {
    file?: File | Blob | null;
    mediaUrl?: string;
    mediaType: 'video' | 'image' | 'text';
    caption: string;
    tags?: string[];
    visibility?: string;
    allowComments?: boolean;
  }) => {
    const taskId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let preview = upload.mediaUrl || '';
    if (upload.file && !preview) {
      try {
        preview = URL.createObjectURL(upload.file);
      } catch {}
    }

    const newTask: BackgroundUploadTask = {
      id: taskId,
      previewUrl: preview,
      mediaType: upload.mediaType,
      caption: upload.caption,
      tags: upload.tags,
      visibility: upload.visibility,
      allowComments: upload.allowComments,
      progress: 5,
      status: 'uploading',
      createdAt: new Date().toISOString(),
    };

    // Add to active uploads
    setActiveUploads(prev => [newTask, ...prev]);

    // Automatically navigate user back to profile right away
    navigate('/profile');

    // Run upload asynchronously in background
    setTimeout(async () => {
      try {
        let content = upload.mediaUrl || '';
        let targetBlob: Blob | null = upload.file || null;
        if (!targetBlob && upload.mediaUrl && upload.mediaUrl.startsWith('blob:')) {
          try {
            const res = await fetch(upload.mediaUrl);
            targetBlob = await res.blob();
          } catch (e) {}
        }

        if (targetBlob) {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (evt) => {
              if (evt.lengthComputable && evt.total > 0) {
                const readPercent = Math.min(20, Math.max(5, Math.round((evt.loaded / evt.total) * 15) + 5));
                setActiveUploads(prev => prev.map(u => u.id === taskId ? { ...u, progress: readPercent } : u));
              }
            };
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read media file'));
            reader.readAsDataURL(targetBlob!);
          });
        }

        const token = await auth.currentUser?.getIdToken();
        const xhr = new XMLHttpRequest();
        activeXhrsRef.current.set(taskId, xhr);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(95, Math.max(20, 20 + Math.round((e.loaded / e.total) * 75)));
            setActiveUploads(prev =>
              prev.map(u => u.id === taskId ? { ...u, progress: percent } : u)
            );
          }
        };

        xhr.onload = () => {
          activeXhrsRef.current.delete(taskId);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData = JSON.parse(xhr.responseText);
              setActiveUploads(prev =>
                prev.map(u => u.id === taskId ? { ...u, progress: 100, status: 'completed', resultPostId: resData.id } : u)
              );

              // Broadcast CREATE event
              const authorId = currentUser?.id || auth.currentUser?.uid;
              if (authorId) {
                globalSyncEngine.dispatchEvent({
                  eventId: crypto.randomUUID(),
                  authorId: authorId,
                  deviceId: 'web-device',
                  objectId: resData.id,
                  operation: 'CREATE',
                  hlc: new Date().toISOString(),
                  payload: { targetType: 'POST', data: resData },
                  signature: 'sig_' + Math.random().toString(36).substring(7)
                });
              }

              // After fully uploaded, redirect user to full watch view or profile
              setTimeout(() => {
                if (resData?.id) {
                  navigate(`/post/${resData.id}`);
                } else {
                  navigate('/profile');
                }
                setTimeout(() => {
                  setActiveUploads(prev => prev.filter(u => u.id !== taskId));
                }, 2000);
              }, 400);
            } catch {
              setActiveUploads(prev =>
                prev.map(u => u.id === taskId ? { ...u, status: 'completed', progress: 100 } : u)
              );
              navigate('/profile');
            }
          } else {
            setActiveUploads(prev =>
              prev.map(u => u.id === taskId ? { ...u, status: 'error', error: 'Upload failed with status ' + xhr.status } : u)
            );
          }
        };

        xhr.onerror = () => {
          activeXhrsRef.current.delete(taskId);
          setActiveUploads(prev =>
            prev.map(u => u.id === taskId ? { ...u, status: 'error', error: 'Connection error during upload' } : u)
          );
        };

        xhr.open('POST', '/api/posts');
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(JSON.stringify({
          type: upload.mediaType,
          content,
          caption: upload.caption,
          tags: upload.tags?.join(','),
          visibility: upload.visibility || 'public',
          allowComments: upload.allowComments ?? true,
        }));
      } catch (err: any) {
        activeXhrsRef.current.delete(taskId);
        setActiveUploads(prev =>
          prev.map(u => u.id === taskId ? { ...u, status: 'error', error: err.message || 'Upload error' } : u)
        );
      }
    }, 50);
  };

  const startBackgroundDownloadVideo = (post: Post) => {
    if (!post) return;
    const videoUrl = post.content.startsWith('/api/') || post.content.startsWith('http')
      ? post.content
      : `/api/posts/${post.id}/media`;

    const downloadId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const filename = `omni_video_${post.id.slice(0, 8)}.mp4`;

    const newDlTask: BackgroundDownloadTask = {
      id: downloadId,
      postId: post.id,
      videoUrl,
      filename,
      progress: 5,
      status: 'downloading',
    };

    setActiveDownloads(prev => [newDlTask, ...prev]);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', videoUrl, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(98, Math.max(10, Math.round((e.loaded / e.total) * 100)));
        setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, progress: percent } : d));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 6000);

        setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, progress: 100, status: 'completed' } : d));

        setDownloadToast('Video saved to downloads');
        setTimeout(() => setDownloadToast(null), 3500);

        setTimeout(() => {
          setActiveDownloads(prev => prev.filter(d => d.id !== downloadId));
        }, 3000);
      } else {
        setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'error', error: 'Download failed' } : d));
      }
    };

    xhr.onerror = () => {
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'error', error: 'Network error' } : d));
    };

    xhr.send();
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      syncState,
      isAuthModalOpen,
      authAction,
      requireAuth,
      closeAuthModal,
      login,
      logout,
      updateCurrentUser,
      dispatchEvent,
      isGlobalMuted,
      setIsGlobalMuted,
      unreadInboxCount,
      refreshUnreadCount,
      isInitialized,
      savedAccounts,
      switchAccount,
      removeSavedAccount,
      activeUploads,
      activeDownloads,
      startBackgroundUpload,
      cancelUpload,
      startBackgroundDownloadVideo
    }}>
      {/* iOS Style Video Downloading HUD Banner */}
      {activeDownloads.filter(d => d.status === 'downloading').map(download => {
        const radius = 11;
        const circumference = 2 * Math.PI * radius;
        const dashoffset = circumference - (download.progress / 100) * circumference;

        return (
          <div
            key={download.id}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-sm bg-black/80 backdrop-blur-xl border border-white/20 text-white px-4 py-2.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                  <circle cx="14" cy="14" r={radius} className="stroke-white/20 fill-transparent" strokeWidth="2.5" />
                  <circle
                    cx="14"
                    cy="14"
                    r={radius}
                    className="stroke-cyan-400 fill-transparent transition-all duration-150"
                    strokeWidth="2.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <Download size={11} className="absolute text-cyan-400 animate-pulse" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">Downloading Video...</span>
                <span className="text-[10px] text-cyan-300 font-semibold">{download.progress}% complete</span>
              </div>
            </div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-full border border-cyan-400/30 shrink-0">
              Background
            </span>
          </div>
        );
      })}

      {/* Video Download Completion Toast */}
      {downloadToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-full bg-emerald-500 text-black font-bold text-xs shadow-xl flex items-center gap-2 animate-in fade-in duration-200">
          <Check size={14} strokeWidth={3} /> {downloadToast}
        </div>
      )}
      {messageToast && (
        <div
          onClick={() => {
            if (messageToast.conversationId) {
              navigate(`/messages/${messageToast.conversationId}`);
            } else {
              navigate('/inbox/messages');
            }
            setMessageToast(null);
          }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm bg-[#121520] text-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-4 duration-300"
        >
          <img
            src={messageToast.senderAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=msg'}
            alt="Sender"
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-cyan-300 truncate">{messageToast.senderName}</span>
              <span className="text-[10px] text-slate-400">now</span>
            </div>
            <p className="text-xs text-slate-200 truncate mt-0.5">{messageToast.text}</p>
          </div>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
