import { auth } from './firebase';
import { getApiUrl } from './api';

const CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export type PublishInput = {
  file: File;
  caption: string;
  visibility: 'public' | 'followers' | 'private';
  allowComments: boolean;
};

export type PublishedPost = { id: string } & Record<string, unknown>;

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error || payload?.message || `Request failed (${response.status})`;
}

export async function publishPost(
  input: PublishInput,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<PublishedPost> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('Sign in before publishing.');
  if (!input.file.size) throw new Error('Choose a non-empty photo or video.');
  if (input.file.size > MAX_UPLOAD_BYTES) throw new Error('Media must be 512 MB or smaller.');
  if (!input.file.type.startsWith('video/') && !input.file.type.startsWith('image/')) {
    throw new Error('Choose a supported photo or video file.');
  }

  const token = await firebaseUser.getIdToken();
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(input.file.size / CHUNK_BYTES);
  let media: { publicUrl?: string; storageKey?: string } | null = null;

  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * CHUNK_BYTES;
    const chunk = input.file.slice(start, Math.min(input.file.size, start + CHUNK_BYTES));
    const response = await fetch(getApiUrl('/api/media/upload'), {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': input.file.type,
        'X-Filename': input.file.name,
        'X-Upload-Id': uploadId,
        'X-Chunk-Index': String(index),
        'X-Total-Chunks': String(totalChunks),
        'X-Total-Size': String(input.file.size),
      },
      body: chunk,
    });
    if (!response.ok) throw new Error(await readError(response));
    media = await response.json();
    onProgress(Math.round(((index + 1) / totalChunks) * 80));
  }

  if (!media?.publicUrl || !media.storageKey) {
    throw new Error('Storage completed without a usable media reference.');
  }

  const response = await fetch(getApiUrl('/api/posts'), {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaUrl: media.publicUrl,
      storageKey: media.storageKey,
      mimeType: input.file.type,
      mediaSize: input.file.size,
      type: input.file.type.startsWith('video/') ? 'video' : 'image',
      caption: input.caption.trim(),
      tags: input.caption.match(/#[\p{L}\p{N}_]+/gu) || [],
      visibility: input.visibility,
      allowComments: input.allowComments,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const post = await response.json();
  if (!post?.id) throw new Error('Post was not persisted. Please try again.');
  onProgress(100);
  return post;
}
