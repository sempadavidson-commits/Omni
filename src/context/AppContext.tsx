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
    thumbnailUrl?: string;
    mediaType: 'video' | 'image' | 'text';
    caption: string;
    tags?: string[];
    visibility?: string;
    allowComments?: boolean;
  }) => Promise<void>;
  cancelUpload: (id: string) => void;
  startBackgroundDownloadVideo: (post: Post) => void;
  feedPosts: Post[];
  setFeedPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  feedActiveIndex: number;
  setFeedActiveIndex: (index: number) => void;
  feedPage: number;
  setFeedPage: (page: number) => void;
  feedHasMore: boolean;
  setFeedHasMore: (hasMore: boolean) => void;
  feedActiveTab: 'foryou' | 'following';
  setFeedActiveTab: (tab: 'foryou' | 'following') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('GLOBAL_ONLINE');

  // Global Home Feed state to persist across screen transitions
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedActiveIndex, setFeedActiveIndex] = useState(0);
  const [feedPage, setFeedPage] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedActiveTab, setFeedActiveTab] = useState<'foryou' | 'following'>('foryou');
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

  // Request notification permission on startup
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Self-contained dual-tone chime sound synthesizer using Web Audio API
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // First chime tone (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // Slide to A5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Second chime tone with slight delay (A5 to D6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22);
      gain2.gain.setValueAtTime(0.10, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);
    } catch (err) {
      console.warn('Failed to play chime sound:', err);
    }
  };

  // Trigger system notification
  const triggerDeviceNotification = (title: string, body: string, iconUrl?: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: iconUrl || '/favicon.ico',
          silent: true, // we play our elegant chime instead of browser default beep
        });
      } catch (e) {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              icon: iconUrl || '/favicon.ico',
              silent: true,
            });
          });
        }
      }
    }
  };

  // Listen for real-time SSE messages for online toast, audio chime, and system notifications
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 1. Direct message notification
        if (data.type === 'NEW_MESSAGE' && data.message) {
          const msg = data.message;
          if (currentUser && msg.senderId !== currentUser.id) {
            setUnreadInboxCount(prev => prev + 1);
            
            // Play pleasant chime
            playChimeSound();
            
            // Trigger device-level system notification
            triggerDeviceNotification(
              `Message from ${msg.sender?.displayName || msg.sender?.username || 'Inbox'}`,
              msg.text || 'Sent media'
            );

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
        
        // 2. Synchronized social events (likes, comments, follows) for real-time popups
        if (data.operation && data.payload) {
          const authorId = data.authorId;
          const isOurAction = authorId === currentUser?.id;
          
          if (!isOurAction && currentUser) {
            const targetType = data.payload.targetType;
            const targetAuthorId = data.payload.targetAuthorId;
            
            // Check for FOLLOW directed at us
            if (data.operation === 'CREATE' && targetType === 'FOLLOW' && data.payload.followingId === currentUser.id) {
              playChimeSound();
              triggerDeviceNotification(
                'New Follower! 👤',
                `Someone is now following you.`
              );
              setUnreadInboxCount(prev => prev + 1);
            }
            // Check for COMMENT on our post
            else if (data.operation === 'CREATE' && targetType === 'COMMENT' && targetAuthorId === currentUser.id) {
              const actorName = data.payload.data?.author?.displayName || data.payload.data?.author?.username || 'Someone';
              const text = data.payload.data?.text || 'commented on your video';
              
              playChimeSound();
              triggerDeviceNotification(
                'New Comment! 💬',
                `${actorName}: "${text}"`
              );
              setUnreadInboxCount(prev => prev + 1);
            }
            // Check for LIKE on our post
            else if (data.operation === 'LIKE' && targetType === 'POST' && targetAuthorId === currentUser.id) {
              playChimeSound();
              triggerDeviceNotification(
                'New Like! ❤️',
                `Someone liked your video.`
              );
              setUnreadInboxCount(prev => prev + 1);
            }
            // Check for REPOST on our post
            else if (data.operation === 'REPOST' && targetType === 'POST' && targetAuthorId === currentUser.id) {
              playChimeSound();
              triggerDeviceNotification(
                'New Repost! 🔁',
                `Someone reposted your video.`
              );
              setUnreadInboxCount(prev => prev + 1);
            }
          }
        }
      } catch (e) {
        console.warn('Could not parse sync event SSE payload:', e);
      }
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

  const switchAccount = async (account: User) => {
    if (!account) return;
    setCurrentUser(account);
    try {
      localStorage.setItem('omni_active_account_id', account.id);
    } catch {}
    if (auth.currentUser && auth.currentUser.uid !== account.id) {
      try {
        await auth.signOut();
      } catch (e) {
        console.warn('Error signing out during account switch:', e);
      }
    }
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
        } catch (e) {
          console.warn('Could not sync user profile from backend on auth change:', e);
        }
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
    const isAuthed = currentUser && auth.currentUser && (auth.currentUser.uid === currentUser.id || auth.currentUser.uid === currentUser.uid);
    if (isAuthed) {
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
    const authorId = auth.currentUser?.uid || currentUser?.id;
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
    thumbnailUrl?: string;
    mediaType: 'video' | 'image' | 'text';
    caption: string;
    tags?: string[];
    visibility?: string;
    allowComments?: boolean;
  }) => {
    const taskId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let preview = upload.thumbnailUrl || upload.mediaUrl || '';
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
        let finalMediaUrl = upload.mediaUrl || '';
        let storageKey: string | null = null;
        let mimeType: string = 'application/octet-stream';
        let mediaSize: number = 0;

        let targetBlob: Blob | null = upload.file || null;
        if (!targetBlob && upload.mediaUrl && upload.mediaUrl.startsWith('blob:')) {
          try {
            const res = await fetch(upload.mediaUrl);
            targetBlob = await res.blob();
          } catch (e) {
            console.warn('Could not fetch target blob from mediaUrl:', e);
          }
        }

        const token = (await auth.currentUser?.getIdToken()) || (currentUser?.id || undefined);

        if (targetBlob) {
          mimeType = targetBlob.type || (upload.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
          mediaSize = targetBlob.size;
          const originalName = (targetBlob as File).name || `upload_${Date.now()}.${mimeType.includes('video') ? 'mp4' : 'jpg'}`;

          // Chunk upload configuration: 4MB chunks (well below proxy client_max_body_size)
          const CHUNK_SIZE = 4 * 1024 * 1024;
          const totalChunks = Math.ceil(targetBlob.size / CHUNK_SIZE) || 1;
          const uploadSessionId = 'upl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

          let mediaMeta: any = null;

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const start = chunkIdx * CHUNK_SIZE;
            const end = Math.min(targetBlob.size, start + CHUNK_SIZE);
            const chunkSlice = targetBlob.slice(start, end);

            let chunkSuccess = false;
            let lastError: any = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const chunkResult = await new Promise((resolve, reject) => {
                  const xhr = new XMLHttpRequest();
                  activeXhrsRef.current.set(taskId, xhr);
                  xhr.open('POST', '/api/media/upload', true);
                  // Ensure cookies and session identifiers are preserved in iframe contexts
                  xhr.withCredentials = true;

                  if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                  }
                  xhr.setRequestHeader('Content-Type', mimeType);
                  xhr.setRequestHeader('X-Filename', originalName);
                  xhr.setRequestHeader('X-Upload-Id', uploadSessionId);
                  xhr.setRequestHeader('X-Chunk-Index', String(chunkIdx));
                  xhr.setRequestHeader('X-Total-Chunks', String(totalChunks));
                  xhr.setRequestHeader('X-Total-Size', String(targetBlob.size));

                  xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable && e.total > 0) {
                      const chunkProgress = e.loaded / e.total;
                      const overallRatio = (chunkIdx + chunkProgress) / totalChunks;
                      const percent = Math.min(80, Math.max(10, Math.round(overallRatio * 70) + 10));
                      setActiveUploads(prev =>
                        prev.map(u => u.id === taskId ? { ...u, progress: percent } : u)
                      );
                    }
                  };

                  xhr.onload = () => {
                    activeXhrsRef.current.delete(taskId);
                    if (xhr.status >= 200 && xhr.status < 300) {
                      try {
                        resolve(JSON.parse(xhr.responseText));
                      } catch {
                        reject(new Error('Invalid response from storage server'));
                      }
                    } else {
                      let errDetail = xhr.statusText;
                      try {
                        const parsed = JSON.parse(xhr.responseText);
                        if (parsed.error) errDetail = parsed.error;
                      } catch {}
                      reject(new Error(`Storage server error (${xhr.status}): ${errDetail}`));
                    }
                  };

                  xhr.onerror = () => {
                    activeXhrsRef.current.delete(taskId);
                    reject(new Error(`Network error uploading media chunk ${chunkIdx + 1}/${totalChunks}`));
                  };

                  xhr.onabort = () => {
                    activeXhrsRef.current.delete(taskId);
                    reject(new Error('Upload cancelled'));
                  };

                  xhr.send(chunkSlice);
                });

                if (chunkIdx === totalChunks - 1) {
                  mediaMeta = chunkResult;
                }
                chunkSuccess = true;
                break;
              } catch (chunkErr: any) {
                lastError = chunkErr;
                if (chunkErr?.message === 'Upload cancelled') {
                  throw chunkErr;
                }
                console.warn(`[UploadManager] Chunk ${chunkIdx + 1}/${totalChunks} attempt ${attempt} failed:`, chunkErr);
                if (attempt < 3) {
                  await new Promise(r => setTimeout(r, attempt * 600));
                }
              }
            }

            // If XHR failed all 3 attempts, attempt native fetch fallback
            if (!chunkSuccess) {
              try {
                console.log(`[UploadManager] Attempting fetch fallback for chunk ${chunkIdx + 1}/${totalChunks}`);
                const fallbackHeaders: Record<string, string> = {
                  'Content-Type': mimeType,
                  'X-Filename': originalName,
                  'X-Upload-Id': uploadSessionId,
                  'X-Chunk-Index': String(chunkIdx),
                  'X-Total-Chunks': String(totalChunks),
                  'X-Total-Size': String(targetBlob.size),
                };
                if (token) fallbackHeaders['Authorization'] = `Bearer ${token}`;

                const fbRes = await fetch('/api/media/upload', {
                  method: 'POST',
                  credentials: 'include',
                  headers: fallbackHeaders,
                  body: chunkSlice,
                });

                if (!fbRes.ok) {
                  const fbErrJson = await fbRes.json().catch(() => ({}));
                  throw new Error(fbErrJson.error || `Upload fallback failed (${fbRes.status})`);
                }

                const fbJson = await fbRes.json();
                if (chunkIdx === totalChunks - 1) {
                  mediaMeta = fbJson;
                }
                chunkSuccess = true;
              } catch (fbErr: any) {
                console.error(`[UploadManager] Fetch fallback failed for chunk ${chunkIdx + 1}:`, fbErr);
                throw lastError || new Error(`Failed to upload media chunk ${chunkIdx + 1}/${totalChunks}`);
              }
            }
          }

          if (mediaMeta && mediaMeta.publicUrl) {
            finalMediaUrl = mediaMeta.publicUrl;
            storageKey = mediaMeta.storageKey;
          }
        }

        // Post metadata to /api/posts
        setActiveUploads(prev => prev.map(u => u.id === taskId ? { ...u, progress: 85 } : u));

        const postRes = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            mediaUrl: finalMediaUrl,
            thumbnailUrl: upload.thumbnailUrl || null,
            storageKey,
            mimeType,
            mediaSize,
            type: upload.mediaType,
            caption: upload.caption,
            tags: upload.tags,
            visibility: upload.visibility,
            allowComments: upload.allowComments,
          }),
        });

        if (!postRes.ok) {
          const errData = await postRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create post');
        }

        const resData = await postRes.json();
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
            signature: 'event_hash_' + authorId + '_' + Date.now(),
          });
        }

        setTimeout(() => {
          if (resData?.id) {
            navigate(`/post/${resData.id}`);
          }
        }, 1200);

      } catch (err: any) {
        console.error('[UploadManager] Media upload failed:', err);
        setActiveUploads(prev =>
          prev.map(u => u.id === taskId ? { ...u, status: 'failed', error: err.message || 'Upload failed' } : u)
        );
      }
    }, 0);
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
      startBackgroundDownloadVideo,
      feedPosts,
      setFeedPosts,
      feedActiveIndex,
      setFeedActiveIndex,
      feedPage,
      setFeedPage,
      feedHasMore,
      setFeedHasMore,
      feedActiveTab,
      setFeedActiveTab
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
