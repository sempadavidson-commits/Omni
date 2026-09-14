/**
 * Real IndexedDB persistence for creator drafts
 * Allows video/audio blobs and metadata to persist across reloads and tab closures.
 */

export interface CreatorDraft {
  id: string;
  mediaUrl: string; // Blob object URL or data URL
  mediaBlob?: Blob;
  mediaType: 'video' | 'image';
  caption: string;
  tags: string;
  visibility: 'public' | 'followers' | 'private';
  allowComments: boolean;
  updatedAt: number;
}

const DB_NAME = 'omni_creator_db';
const DB_VERSION = 1;
const DRAFTS_STORE = 'drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(draft: CreatorDraft): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = tx.objectStore(DRAFTS_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage metadata if IndexedDB fails
    try {
      localStorage.setItem('omni_creator_draft_meta', JSON.stringify({
        id: draft.id,
        mediaType: draft.mediaType,
        caption: draft.caption,
        tags: draft.tags,
        visibility: draft.visibility,
        allowComments: draft.allowComments,
        updatedAt: draft.updatedAt
      }));
    } catch (e) {}
  }
}

export async function getLatestDraft(): Promise<CreatorDraft | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(DRAFTS_STORE, 'readonly');
    const store = tx.objectStore(DRAFTS_STORE);
    return await new Promise<CreatorDraft | null>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results: CreatorDraft[] = req.result;
        if (results && results.length > 0) {
          // Return the latest one
          results.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(results[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const saved = localStorage.getItem('omni_creator_draft_meta');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  }
}

export async function clearDraft(id?: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = tx.objectStore(DRAFTS_STORE);
    if (id) {
      store.delete(id);
    } else {
      store.clear();
    }
  } catch (err) {}
  localStorage.removeItem('omni_creator_draft_meta');
}
