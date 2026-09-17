import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoredMediaMetadata {
  storageKey: string;
  filename: string;
  mimeType: string;
  mediaSize: number;
  mediaType: 'video' | 'image' | 'audio';
  publicUrl: string;
  createdAt: string;
}

type UploadState = {
  nextChunkIndex: number;
  totalChunks: number;
  totalBytes: number;
  originalFilename: string;
  mimeType: string;
};

const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 512 * 1024 * 1024);
const MAX_CHUNKS = 512;
const MAX_CHUNK_BYTES = 32 * 1024 * 1024;
const STORAGE_DIR = process.env.MEDIA_STORAGE_DIR
  ? path.resolve(process.env.MEDIA_STORAGE_DIR)
  : path.join(process.cwd(), 'uploads');

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
};

function normalizeMime(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

function validateMedia(buffer: Buffer, mimeType: string): string {
  const normalized = normalizeMime(mimeType);
  if (!MIME_EXTENSIONS[normalized]) throw new Error('UNSUPPORTED_MEDIA_TYPE');
  if (buffer.length === 0) throw new Error('EMPTY_MEDIA');
  if (buffer.length > MAX_MEDIA_BYTES) throw new Error('MEDIA_TOO_LARGE');
  return normalized;
}

function mediaTypeFor(mimeType: string): StoredMediaMetadata['mediaType'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'image';
}

function safeOriginalFilename(filename: string): string {
  const value = path.basename(filename).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
  return value || 'media';
}

function tempPaths(uploadId: string) {
  return {
    part: path.join(STORAGE_DIR, `temp_${uploadId}.part`),
    state: path.join(STORAGE_DIR, `temp_${uploadId}.json`),
    completed: path.join(STORAGE_DIR, `upload_${uploadId}.complete.json`),
  };
}

async function writeJson(filePath: string, value: unknown) {
  await fs.promises.writeFile(filePath, JSON.stringify(value), { encoding: 'utf8', flag: 'w' });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

fs.mkdirSync(STORAGE_DIR, { recursive: true });

void (async () => {
  try {
    const now = Date.now();
    for (const filename of await fs.promises.readdir(STORAGE_DIR)) {
      if (!filename.startsWith('temp_') && !filename.startsWith('upload_')) continue;
      const filePath = path.join(STORAGE_DIR, filename);
      const stat = await fs.promises.stat(filePath);
      if (now - stat.mtimeMs > 2 * 60 * 60 * 1000) await fs.promises.unlink(filePath);
    }
  } catch (error) {
    console.warn('Could not clean stale media uploads:', error);
  }
})();

export const mediaStorage = {
  async saveMedia(buffer: Buffer, originalFilename = 'media', mimeType = 'application/octet-stream'): Promise<StoredMediaMetadata> {
    const normalizedMime = validateMedia(buffer, mimeType);
    const storageKey = `${crypto.randomUUID()}${MIME_EXTENSIONS[normalizedMime]}`;
    const filePath = path.join(STORAGE_DIR, storageKey);
    await fs.promises.writeFile(filePath, buffer, { flag: 'wx' });

    const metadata: StoredMediaMetadata = {
      storageKey,
      filename: safeOriginalFilename(originalFilename),
      mimeType: normalizedMime,
      mediaSize: buffer.length,
      mediaType: mediaTypeFor(normalizedMime),
      publicUrl: `/api/media/file/${storageKey}`,
      createdAt: new Date().toISOString(),
    };
    await writeJson(`${filePath}.meta.json`, metadata);
    return metadata;
  },

  async saveChunk(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkBuffer: Buffer,
    originalFilename = 'media',
    mimeType = 'application/octet-stream',
  ): Promise<{ completed: boolean; meta?: StoredMediaMetadata; chunkIndex: number; totalChunks: number }> {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(uploadId)) throw new Error('INVALID_UPLOAD_ID');
    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || totalChunks > MAX_CHUNKS || chunkIndex >= totalChunks) {
      throw new Error('INVALID_CHUNK_RANGE');
    }
    if (!Buffer.isBuffer(chunkBuffer) || chunkBuffer.length === 0) throw new Error('EMPTY_MEDIA');
    if (chunkBuffer.length > MAX_CHUNK_BYTES) throw new Error('CHUNK_TOO_LARGE');

    const normalizedMime = normalizeMime(mimeType);
    if (!MIME_EXTENSIONS[normalizedMime]) throw new Error('UNSUPPORTED_MEDIA_TYPE');
    const files = tempPaths(uploadId);
    const completed = await readJson<StoredMediaMetadata>(files.completed);
    if (completed) return { completed: true, meta: completed, chunkIndex, totalChunks };

    let state = await readJson<UploadState>(files.state);
    if (!state) {
      if (chunkIndex !== 0) throw new Error('CHUNK_OUT_OF_ORDER');
      state = { nextChunkIndex: 0, totalChunks, totalBytes: 0, originalFilename: safeOriginalFilename(originalFilename), mimeType: normalizedMime };
    }
    if (state.totalChunks !== totalChunks || state.mimeType !== normalizedMime) throw new Error('UPLOAD_METADATA_MISMATCH');
    if (chunkIndex < state.nextChunkIndex) return { completed: false, chunkIndex, totalChunks };
    if (chunkIndex !== state.nextChunkIndex) throw new Error('CHUNK_OUT_OF_ORDER');
    if (state.totalBytes + chunkBuffer.length > MAX_MEDIA_BYTES) throw new Error('MEDIA_TOO_LARGE');

    await fs.promises.writeFile(files.part, chunkBuffer, { flag: chunkIndex === 0 ? 'w' : 'a' });
    state.nextChunkIndex += 1;
    state.totalBytes += chunkBuffer.length;
    await writeJson(files.state, state);

    if (state.nextChunkIndex < totalChunks) return { completed: false, chunkIndex, totalChunks };

    const storageKey = `${crypto.randomUUID()}${MIME_EXTENSIONS[normalizedMime]}`;
    const destination = path.join(STORAGE_DIR, storageKey);
    await fs.promises.rename(files.part, destination);
    const stat = await fs.promises.stat(destination);
    if (stat.size !== state.totalBytes || stat.size === 0) {
      await fs.promises.unlink(destination).catch(() => undefined);
      throw new Error('UPLOAD_SIZE_MISMATCH');
    }

    const metadata: StoredMediaMetadata = {
      storageKey,
      filename: state.originalFilename,
      mimeType: normalizedMime,
      mediaSize: stat.size,
      mediaType: mediaTypeFor(normalizedMime),
      publicUrl: `/api/media/file/${storageKey}`,
      createdAt: new Date().toISOString(),
    };
    await writeJson(`${destination}.meta.json`, metadata);
    await writeJson(files.completed, metadata);
    await fs.promises.unlink(files.state).catch(() => undefined);
    return { completed: true, meta: metadata, chunkIndex, totalChunks };
  },

  async saveMediaFromStream(stream: NodeJS.ReadableStream, originalFilename = 'media', mimeType = 'application/octet-stream'): Promise<StoredMediaMetadata> {
    const normalizedMime = normalizeMime(mimeType);
    if (!MIME_EXTENSIONS[normalizedMime]) throw new Error('UNSUPPORTED_MEDIA_TYPE');
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > MAX_MEDIA_BYTES) throw new Error('MEDIA_TOO_LARGE');
      chunks.push(buffer);
    }
    return this.saveMedia(Buffer.concat(chunks), originalFilename, normalizedMime);
  },

  async deleteMedia(storageKey: string): Promise<boolean> {
    if (!storageKey) return false;
    const cleanKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_DIR, cleanKey);
    try {
      await fs.promises.unlink(filePath);
      await fs.promises.unlink(`${filePath}.meta.json`).catch(() => undefined);
      return true;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') console.error(`Failed to delete media object ${cleanKey}:`, error);
      return false;
    }
  },

  getFilePath(storageKey: string): string | null {
    const cleanKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_DIR, cleanKey);
    return fs.existsSync(filePath) ? filePath : null;
  },

  getMediaMetadata(storageKey: string): StoredMediaMetadata | null {
    const cleanKey = path.basename(storageKey);
    try {
      return JSON.parse(fs.readFileSync(path.join(STORAGE_DIR, `${cleanKey}.meta.json`), 'utf8')) as StoredMediaMetadata;
    } catch {
      return null;
    }
  },

  getPublicUrl(storageKey: string): string {
    return `/api/media/file/${path.basename(storageKey)}`;
  },
};
