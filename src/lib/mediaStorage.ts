import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredMediaMetadata {
  storageKey: string;
  filename: string;
  mimeType: string;
  mediaSize: number;
  mediaType: 'video' | 'image' | 'audio' | 'raw';
  publicUrl: string;
  createdAt: string;
}

const STORAGE_DIR = process.env.MEDIA_STORAGE_DIR 
  ? path.resolve(process.env.MEDIA_STORAGE_DIR) 
  : path.join(process.cwd(), 'uploads');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create storage directory:', err);
  }
}

// Clean any stale temp upload parts older than 2 hours
try {
  if (fs.existsSync(STORAGE_DIR)) {
    const files = fs.readdirSync(STORAGE_DIR);
    const now = Date.now();
    for (const file of files) {
      if (file.startsWith('temp_') && file.endsWith('.part')) {
        const fullPath = path.join(STORAGE_DIR, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > 7200 * 1000) {
            fs.unlinkSync(fullPath);
          }
        } catch {}
      }
    }
  }
} catch (e) {
  console.warn('Initial cleanup of stale temp files skipped:', e);
}

export const mediaStorage = {
  /**
   * Save incoming file buffer or stream directly to storage without memory bloating.
   */
  async saveMedia(buffer: Buffer, originalFilename: string = 'media.bin', mimeType: string = 'application/octet-stream'): Promise<StoredMediaMetadata> {
    const ext = path.extname(originalFilename) || (mimeType.includes('video') ? '.mp4' : mimeType.includes('image') ? '.jpg' : '.bin');
    const fileId = crypto.randomUUID();
    const storageKey = `${fileId}${ext}`;
    const filePath = path.join(STORAGE_DIR, storageKey);

    await fs.promises.writeFile(filePath, buffer);

    const mediaType: 'video' | 'image' | 'audio' | 'raw' = mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('audio/')
      ? 'audio'
      : 'raw';

    const metadata: StoredMediaMetadata = {
      storageKey,
      filename: originalFilename,
      mimeType,
      mediaSize: buffer.length,
      mediaType,
      publicUrl: `/api/media/file/${storageKey}`,
      createdAt: new Date().toISOString(),
    };

    try {
      await fs.promises.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2));
    } catch {}

    return metadata;
  },

  /**
   * Save an uploaded chunk. When the final chunk arrives, renames to final destination and returns full metadata.
   */
  async saveChunk(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkBuffer: Buffer,
    originalFilename: string = 'media.bin',
    mimeType: string = 'application/octet-stream'
  ): Promise<{ completed: boolean; meta?: StoredMediaMetadata; chunkIndex: number; totalChunks: number }> {
    const cleanUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '') || crypto.randomUUID();
    const tempFilePath = path.join(STORAGE_DIR, `temp_${cleanUploadId}.part`);

    if (chunkIndex === 0 || !fs.existsSync(tempFilePath)) {
      await fs.promises.writeFile(tempFilePath, chunkBuffer);
    } else {
      await fs.promises.appendFile(tempFilePath, chunkBuffer);
    }

    if (chunkIndex >= totalChunks - 1) {
      const ext = path.extname(originalFilename) || (mimeType.includes('video') ? '.mp4' : mimeType.includes('image') ? '.jpg' : '.bin');
      const fileId = crypto.randomUUID();
      const storageKey = `${fileId}${ext}`;
      const destPath = path.join(STORAGE_DIR, storageKey);

      await fs.promises.rename(tempFilePath, destPath);
      const stat = await fs.promises.stat(destPath);

      const mediaType: 'video' | 'image' | 'audio' | 'raw' = mimeType.startsWith('video/')
        ? 'video'
        : mimeType.startsWith('image/')
        ? 'image'
        : mimeType.startsWith('audio/')
        ? 'audio'
        : 'raw';

      const chunkMeta: StoredMediaMetadata = {
        storageKey,
        filename: originalFilename,
        mimeType,
        mediaSize: stat.size,
        mediaType,
        publicUrl: `/api/media/file/${storageKey}`,
        createdAt: new Date().toISOString(),
      };

      try {
        await fs.promises.writeFile(`${destPath}.meta.json`, JSON.stringify(chunkMeta, null, 2));
      } catch {}

      return {
        completed: true,
        meta: chunkMeta,
        chunkIndex,
        totalChunks,
      };
    }

    return {
      completed: false,
      chunkIndex,
      totalChunks,
    };
  },

  /**
   * Save media from a stream directly to disk.
   */
  async saveMediaFromStream(stream: NodeJS.ReadableStream, originalFilename: string = 'media.bin', mimeType: string = 'application/octet-stream'): Promise<StoredMediaMetadata> {
    const ext = path.extname(originalFilename) || (mimeType.includes('video') ? '.mp4' : mimeType.includes('image') ? '.jpg' : '.bin');
    const fileId = crypto.randomUUID();
    const storageKey = `${fileId}${ext}`;
    const filePath = path.join(STORAGE_DIR, storageKey);

    const writeStream = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stat = await fs.promises.stat(filePath);
    const mediaType: 'video' | 'image' | 'audio' | 'raw' = mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('audio/')
      ? 'audio'
      : 'raw';

    return {
      storageKey,
      filename: originalFilename,
      mimeType,
      mediaSize: stat.size,
      mediaType,
      publicUrl: `/api/media/file/${storageKey}`,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Remove media object from storage permanently.
   */
  async deleteMedia(storageKey: string): Promise<boolean> {
    if (!storageKey) return false;
    // Extract base filename if full path/URL was passed
    const cleanKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_DIR, cleanKey);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
    } catch (err) {
      console.error(`Failed to delete media object ${storageKey}:`, err);
    }
    return false;
  },

  /**
   * Get file path for range streaming.
   */
  getFilePath(storageKey: string): string | null {
    const cleanKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_DIR, cleanKey);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  },

  getMediaMetadata(storageKey: string): StoredMediaMetadata | null {
    const cleanKey = path.basename(storageKey);
    const metaPath = path.join(STORAGE_DIR, `${cleanKey}.meta.json`);
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf8');
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  },

  getPublicUrl(storageKey: string): string {
    const cleanKey = path.basename(storageKey);
    return `/api/media/file/${cleanKey}`;
  }
};
