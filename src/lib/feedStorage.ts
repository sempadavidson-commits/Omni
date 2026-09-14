import { Post } from '../types';

const DB_NAME = 'omni_feed_db';
const DB_VERSION = 1;
const POSTS_STORE = 'feed_posts';
const ACTIONS_STORE = 'offline_actions';

export interface OfflineAction {
  id?: number;
  type: 'LIKE' | 'BOOKMARK' | 'COMMENT' | 'FOLLOW';
  targetId: string;
  payload?: any;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(POSTS_STORE)) {
        const postStore = db.createObjectStore(POSTS_STORE, { keyPath: 'id' });
        postStore.createIndex('tab', 'tab', { unique: false });
        postStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(ACTIONS_STORE)) {
        db.createObjectStore(ACTIONS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Persists feed posts into IndexedDB for instant offline access
 */
export async function savePostsToOffline(posts: Post[], tab: string = 'foryou'): Promise<void> {
  if (!Array.isArray(posts) || posts.length === 0) return;

  try {
    const db = await openDB();
    const tx = db.transaction(POSTS_STORE, 'readwrite');
    const store = tx.objectStore(POSTS_STORE);

    for (const post of posts) {
      if (!post || !post.id) continue;
      // Attach tab tag for querying
      const postWithTab = { ...post, tab };
      store.put(postWithTab);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[feedStorage] Failed to persist posts to IndexedDB:', err);
  }
}

/**
 * Retrieves cached feed posts from IndexedDB when offline or during initial render
 */
export async function getOfflinePosts(tab: string = 'foryou'): Promise<Post[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const index = store.index('tab');

    const request = index.getAll(IDBKeyRange.only(tab));

    const posts = await new Promise<Post[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (posts.length === 0) {
      // If none found for this specific tab, fallback to all cached posts
      const allRequest = store.getAll();
      return await new Promise<Post[]>((resolve, reject) => {
        allRequest.onsuccess = () => resolve(allRequest.result || []);
        allRequest.onerror = () => reject(allRequest.error);
      });
    }

    // Sort newest first
    return posts.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.warn('[feedStorage] Failed to read cached posts from IndexedDB:', err);
    return [];
  }
}

/**
 * Queues an offline interaction (like, bookmark, comment) to be synchronized once connection returns
 */
export async function recordOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(ACTIONS_STORE, 'readwrite');
    const store = tx.objectStore(ACTIONS_STORE);

    const record: OfflineAction = {
      ...action,
      timestamp: Date.now(),
    };

    store.add(record);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.log('[feedStorage] Recorded offline action:', record.type, record.targetId);
  } catch (err) {
    console.warn('[feedStorage] Failed to queue offline action:', err);
  }
}

/**
 * Replays all queued offline actions to the backend when internet is restored
 */
export async function syncOfflineActions(token?: string): Promise<number> {
  if (!token) return 0;

  try {
    const db = await openDB();
    const tx = db.transaction(ACTIONS_STORE, 'readonly');
    const store = tx.objectStore(ACTIONS_STORE);
    const request = store.getAll();

    const actions: OfflineAction[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (actions.length === 0) return 0;

    let syncedCount = 0;

    for (const action of actions) {
      try {
        let res: Response | null = null;

        if (action.type === 'LIKE') {
          res = await fetch(`/api/posts/${action.targetId}/like`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } else if (action.type === 'BOOKMARK') {
          res = await fetch(`/api/posts/${action.targetId}/bookmark`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } else if (action.type === 'COMMENT' && action.payload?.text) {
          res = await fetch(`/api/posts/${action.targetId}/comments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text: action.payload.text }),
          });
        } else if (action.type === 'FOLLOW') {
          res = await fetch(`/api/follow/${action.targetId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        if (res && (res.ok || res.status === 409)) {
          // Remove completed action
          const deleteTx = db.transaction(ACTIONS_STORE, 'readwrite');
          if (action.id !== undefined) {
            deleteTx.objectStore(ACTIONS_STORE).delete(action.id);
          }
          syncedCount++;
        }
      } catch (e) {
        console.warn('[feedStorage] Failed to replay action, will retry next time:', action, e);
      }
    }

    console.log(`[feedStorage] Synced ${syncedCount}/${actions.length} offline actions to backend.`);
    return syncedCount;
  } catch (err) {
    console.warn('[feedStorage] Failed to synchronize offline actions:', err);
    return 0;
  }
}
