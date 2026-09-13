import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SyncState, User } from '../types';
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
  const transportRef = useRef(new HttpTransport());

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

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create user session locally
        setCurrentUser({
          id: user.uid,
          uid: user.uid,
          email: user.email || undefined,
          username: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : 'user_' + user.uid.substring(0, 6),
          displayName: user.displayName || 'New User',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          followersCount: 0,
          followingCount: 0,
        });
        
        // Fetch accurate DB user if possible
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.dbUser) {
            setCurrentUser(prev => ({
              ...prev!,
              id: data.dbUser.uid || prev!.id,
              uid: data.dbUser.uid,
              username: data.dbUser.username,
              avatar: data.dbUser.avatar,
              displayName: data.dbUser.displayName,
              bio: data.dbUser.bio,
              followersCount: data.dbUser.followersCount,
              followingCount: data.dbUser.followingCount,
              lastUsernameChangeAt: data.dbUser.lastUsernameChangeAt,
            }));
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
      isInitialized
    }}>
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
