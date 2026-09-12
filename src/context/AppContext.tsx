import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  dispatchEvent: (event: Partial<SocialEvent>) => void;
  isGlobalMuted: boolean;
  setIsGlobalMuted: (muted: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('GLOBAL_ONLINE');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authAction, setAuthAction] = useState<AuthAction | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
  const [isGlobalMuted, setIsGlobalMuted] = useState(true);
  
  const transportRef = useRef(new HttpTransport());

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create user session locally
        setCurrentUser({
          id: user.uid,
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
              username: data.dbUser.username,
              avatar: data.dbUser.avatar,
              displayName: data.dbUser.displayName,
              bio: data.dbUser.bio,
              followersCount: data.dbUser.followersCount,
              followingCount: data.dbUser.followingCount,
            }));
          }
        } catch (e) {}
      } else {
        setCurrentUser(null);
      }
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
    
    // Set immediately so pending callbacks can potentially rely on UI state
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
      // Use setTimeout to ensure state updates have flushed, though using auth.currentUser directly in dispatchEvent is safer
      setTimeout(() => {
        pendingCallback();
      }, 0);
      setPendingCallback(null);
    }
  };

  const logout = () => {
    auth.signOut();
    setCurrentUser(null);
  };
  
  // Expose dispatch for UI to generate local-first events
  const dispatchEvent = (eventData: Partial<SocialEvent>) => {
    const authorId = currentUser?.id || auth.currentUser?.uid;
    if (!authorId) return;
    
    const fullEvent: SocialEvent = {
      eventId: crypto.randomUUID(),
      authorId: authorId,
      deviceId: 'web-device',
      objectId: eventData.objectId || crypto.randomUUID(),
      operation: eventData.operation || 'UPDATE',
      hlc: new Date().toISOString(), // Simplified HLC for web prototype
      payload: eventData.payload || {},
      signature: 'mock_sig_' + Math.random().toString(36).substring(7)
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
      dispatchEvent,
      isGlobalMuted,
      setIsGlobalMuted
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
