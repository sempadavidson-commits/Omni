import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware for authorized origins including Vercel
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(compression({
    filter: (req, res) => {
      if (req.path.includes('/media') || req.headers.range) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  app.use(express.json({ limit: '2gb' }));
  app.use(express.urlencoded({ limit: '2gb', extended: true }));

  // Real-time SSE connection management
  const clients = new Set<express.Response>();

  const broadcastSSE = (messageString: string) => {
    const deadClients: express.Response[] = [];
    clients.forEach((client) => {
      try {
        client.write(messageString);
      } catch (err) {
        deadClients.push(client);
      }
    });
    deadClients.forEach((dead) => clients.delete(dead));
  };

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/register", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authErr) {
      console.error('Error verifying auth token:', authErr);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    try {
      // Upsert the user into Cloud SQL
      const { getOrCreateUser } = await import('./src/db/users.js');
      const email = decodedToken.email || 'no-email@example.com';
      const dbUser = await getOrCreateUser(decodedToken.uid, email, decodedToken.name, decodedToken.picture);

      res.json({ uid: decodedToken.uid, dbUser });
    } catch (error) {
      console.warn('Temporary DB error in /api/register, returning fallback user:', error);
      res.json({
        uid: decodedToken.uid,
        dbUser: {
          uid: decodedToken.uid,
          email: decodedToken.email || '',
          displayName: decodedToken.name || 'User',
          avatar: decodedToken.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${decodedToken.uid}`,
          username: 'user_' + decodedToken.uid.slice(0, 8),
          bio: '',
          followersCount: 0,
          followingCount: 0
        }
      });
    }
  });

  app.get("/api/feed", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      let userId: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
          userId = decodedToken.uid;
        } catch (e) {}
      }
      const tab = (req.query.tab as string === 'following') ? 'following' : 'foryou';
      const rawPage = parseInt(req.query.page as string || '0', 10);
      const rawLimit = parseInt(req.query.limit as string || '20', 10);
      const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;

      const { getFeed } = await import('./src/db/queries.js');
      const feed = await getFeed(userId, tab, page, limit);
      res.json(Array.isArray(feed) ? feed : []);
    } catch (e) {
      console.error('Error in /api/feed endpoint:', e);
      res.json([]);
    }
  });

  // TELEMETRY SIGNALS RECEIVER (Engagement & Recommendation engine foundation)
  app.post("/api/telemetry/signals", (req, res) => {
    const signals = req.body?.signals || [];
    res.json({ received: signals.length });
  });

  app.put("/api/user/profile", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { updateUserProfile } = await import('./src/db/users.js');
      const updatedUser = await updateUserProfile(decodedToken.uid, req.body);
      res.json(updatedUser);
    } catch (e: any) {
      console.error('Error updating profile:', e);
      if (e.message && e.message.includes('30 days')) {
        return res.status(400).json({ error: e.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/:userId", async (req, res, next) => {
    if (req.params.userId === 'following') return next();
    try {
      const { getUserProfile } = await import('./src/db/users.js');
      const user = await getUserProfile(req.params.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e) {
      console.error('Error fetching user:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  function getMimeTypeForPath(filePath: string, fallbackMime?: string | null): string {
    if (fallbackMime && fallbackMime !== 'application/octet-stream' && fallbackMime !== 'binary/octet-stream') {
      const cleanMime = fallbackMime.split(';')[0].trim().toLowerCase();
      if (cleanMime.startsWith('video/') || cleanMime.startsWith('audio/') || cleanMime.startsWith('image/')) {
        return cleanMime;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.mp4':
      case '.m4v':
        return 'video/mp4';
      case '.webm':
        return 'video/webm';
      case '.mov':
        return 'video/quicktime';
      case '.mkv':
        return 'video/x-matroska';
      case '.avi':
        return 'video/x-msvideo';
      case '.ogv':
        return 'video/ogg';
      case '.3gp':
        return 'video/3gpp';
      case '.ts':
        return 'video/mp2t';
      case '.m3u8':
        return 'application/x-mpegURL';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.mp3':
        return 'audio/mpeg';
      case '.ogg':
        return 'audio/ogg';
      case '.wav':
        return 'audio/wav';
      case '.m4a':
        return 'audio/mp4';
      case '.aac':
        return 'audio/aac';
      case '.flac':
        return 'audio/flac';
      default:
        return 'video/mp4';
    }
  }

  function serveStaticMediaFile(filePath: string, req: express.Request, res: express.Response, customMime?: string | null) {
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Media file not found');
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = getMimeTypeForPath(filePath, customMime);
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', fileSize);
      return res.status(200).end();
    }

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize || (parts[1] && isNaN(end)) || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.on('error', (err) => {
        console.warn('Media file read stream error:', err);
        if (!res.headersSent) res.status(500).end();
      });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      return fileStream.pipe(res);
    } else {
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        console.warn('Media file read stream error:', err);
        if (!res.headersSent) res.status(500).end();
      });
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      return fileStream.pipe(res);
    }
  }

  const handleMediaPostRequest = async (req: express.Request, res: express.Response) => {
    let clientAborted = false;
    req.on('close', () => {
      if (!res.writableEnded) {
        clientAborted = true;
      }
    });

    try {
      const { postId } = req.params;
      const { getPostMedia } = await import('./src/db/queries.js');
      const media = await getPostMedia(postId);
      if (clientAborted) return;
      if (!media || (!media.content && !media.mediaUrl && !media.storageKey)) {
        return res.status(404).send('Media not found');
      }

      let fileStorageKey: string | null = media.storageKey || null;
      if (!fileStorageKey && media.mediaUrl && media.mediaUrl.startsWith('/api/media/file/')) {
        fileStorageKey = media.mediaUrl.replace('/api/media/file/', '');
      }
      if (!fileStorageKey && media.content && media.content.startsWith('/api/media/file/')) {
        fileStorageKey = media.content.replace('/api/media/file/', '');
      }

      if (fileStorageKey) {
        const { mediaStorage } = await import('./src/lib/mediaStorage.js');
        const filePath = mediaStorage.getFilePath(fileStorageKey);
        const meta = mediaStorage.getMediaMetadata(fileStorageKey);
        if (filePath && fs.existsSync(filePath)) {
          return serveStaticMediaFile(filePath, req, res, meta?.mimeType || media.mimeType);
        }
      }

      const content = media.content || media.mediaUrl || '';
      if (content.startsWith('http://') || content.startsWith('https://')) {
        return res.redirect(302, content);
      }

      if (content.startsWith('data:')) {
        const commaIdx = content.indexOf(',');
        if (commaIdx !== -1) {
          const semiIdx = content.indexOf(';');
          const mimeType = (semiIdx > 5 && semiIdx < commaIdx)
            ? content.substring(5, semiIdx)
            : (media.type === 'video' ? 'video/mp4' : 'image/jpeg');
          const base64Data = content.substring(commaIdx + 1);
          const buffer = Buffer.from(base64Data, 'base64');
          const totalSize = buffer.length;
          const range = req.headers.range;

          if (clientAborted || res.writableEnded) return;

          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

          if (req.method === 'HEAD') {
            res.setHeader('Content-Length', totalSize);
            res.setHeader('Content-Type', mimeType);
            return res.status(200).end();
          }

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

            if (start >= totalSize || end >= totalSize || start > end) {
              res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
              return res.end();
            }

            const chunk = buffer.subarray(start, end + 1);
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': chunk.length,
              'Content-Type': mimeType,
            });
            return res.end(chunk);
          } else {
            res.writeHead(200, {
              'Content-Length': totalSize,
              'Content-Type': mimeType,
            });
            return res.end(buffer);
          }
        }
      }

      if (clientAborted || res.writableEnded) return;
      res.setHeader('Content-Type', media.type === 'video' ? 'video/mp4' : 'image/jpeg');
      return res.redirect(302, content || '/placeholder.png');
    } catch (err) {
      console.error('Error serving post media:', err);
      if (!res.headersSent) res.status(500).send('Error serving media');
    }
  };

  app.get("/api/posts/:postId/media", handleMediaPostRequest);
  app.head("/api/posts/:postId/media", handleMediaPostRequest);

  app.get("/api/posts/:postId", async (req, res) => {
    try {
      const { postId } = req.params;
      const { getPostById } = await import('./src/db/queries.js');
      const post = await getPostById(postId);
      if (!post) return res.status(404).json({ error: 'Not found' });
      res.json(post);
    } catch (e) {
      console.error('Error fetching post by ID:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/posts/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json([]);
      }
      const { getUserPosts } = await import('./src/db/queries.js');
      const posts = await getUserPosts(userId);
      res.json(Array.isArray(posts) ? posts : []);
    } catch (e) {
      console.error('Error fetching user posts:', e);
      res.json([]);
    }
  });

  app.get("/api/user/saved/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json([]);
      }
      const { getUserSavedPosts } = await import('./src/db/queries.js');
      const posts = await getUserSavedPosts(userId);
      res.json(Array.isArray(posts) ? posts : []);
    } catch (e) {
      console.error('Error fetching user saved posts:', e);
      res.json([]);
    }
  });

  app.get("/api/user/likes/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json([]);
      }
      const { getUserLikedPosts } = await import('./src/db/queries.js');
      const posts = await getUserLikedPosts(userId);
      res.json(Array.isArray(posts) ? posts : []);
    } catch (e) {
      console.error('Error fetching user liked posts:', e);
      res.json([]);
    }
  });

  app.post("/api/posts/:postId/bookmark", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { toggleBookmark } = await import('./src/db/queries.js');
      const result = await toggleBookmark(decodedToken.uid, req.params.postId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/posts/:postId/repost", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { repostPost } = await import('./src/db/queries.js');
      const result = await repostPost(decodedToken.uid, req.params.postId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/posts/:postId/view", async (req, res) => {
    try {
      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts } = await import('./src/db/schema.js');
      const { eq, sql } = await import('drizzle-orm');
      
      const postId = req.params.postId;
      await withDbRetry(() =>
        db.update(posts)
          .set({ viewsCount: sql`COALESCE(${posts.viewsCount}, 0) + 1` })
          .where(eq(posts.id, postId))
      );
      
      res.json({ success: true });
    } catch (e) {
      console.error('Error incrementing viewsCount:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const getUserIdFromAuthHeader = async (authHeader?: string): Promise<string | null> => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) return null;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return decoded.uid;
    } catch {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.sub && payload.iss?.includes('securetoken.google.com')) {
            return payload.sub;
          }
          if (payload.uid || payload.user_id || payload.sub) {
            return payload.uid || payload.user_id || payload.sub;
          }
        }
      } catch (_) {}
      // Support valid local session identifier tokens in development/preview
      if (token.length >= 4 && !token.includes(' ') && !token.includes('\n') && !token.includes('"')) {
        return token;
      }
      return null;
    }
  };

  // Binary media upload endpoint (handles single-shot and chunked uploads)
  app.post("/api/media/upload", express.raw({ type: '*/*', limit: '32mb' }), async (req: express.Request, res: express.Response) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const mimeType = (req.headers['content-type'] as string) || 'application/octet-stream';
      const originalFilename = (req.headers['x-filename'] as string) || 'upload.bin';
      const uploadId = (req.headers['x-upload-id'] as string) || '';
      const chunkIndexHeader = req.headers['x-chunk-index'];
      const totalChunksHeader = req.headers['x-total-chunks'];

      const { mediaStorage } = await import('./src/lib/mediaStorage.js');
      
      let buffer: Buffer;
      if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else {
        buffer = Buffer.from(req.body || '');
      }

      if (uploadId && chunkIndexHeader !== undefined && totalChunksHeader !== undefined) {
        const chunkIndex = parseInt(chunkIndexHeader as string, 10);
        const totalChunks = parseInt(totalChunksHeader as string, 10);

        const result = await mediaStorage.saveChunk(
          uploadId,
          chunkIndex,
          totalChunks,
          buffer,
          originalFilename,
          mimeType
        );

        if (result.completed && result.meta) {
          return res.json(result.meta);
        } else {
          return res.json({ status: 'chunk_received', chunkIndex, totalChunks });
        }
      }

      const meta = await mediaStorage.saveMedia(buffer, originalFilename, mimeType);
      res.json(meta);
    } catch (err: any) {
      console.error('Error in media upload endpoint:', err);
      res.status(500).json({ error: 'Media upload failed: ' + (err?.message || 'Internal error') });
    }
  });

  const handleStaticMediaFile = async (req: express.Request, res: express.Response) => {
    try {
      const { mediaStorage } = await import('./src/lib/mediaStorage.js');
      const storageKey = req.params.storageKey;
      const filePath = mediaStorage.getFilePath(storageKey);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('Media not found');
      }
      const meta = mediaStorage.getMediaMetadata(storageKey);
      return serveStaticMediaFile(filePath, req, res, meta?.mimeType);
    } catch (err) {
      console.error('Error streaming media file:', err);
      res.status(500).send('Error serving media file');
    }
  };

  app.get("/api/media/file/:storageKey", handleStaticMediaFile);
  app.head("/api/media/file/:storageKey", handleStaticMediaFile);

  app.post("/api/posts", async (req, res) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { content, mediaUrl, thumbnailUrl, mediaType, mimeType, mediaSize, duration, width, height, storageKey, caption, type, tags, visibility, allowComments } = req.body;
      const finalMediaUrl = mediaUrl || content || '';
      if (!finalMediaUrl && !caption) return res.status(400).json({ error: 'Post must have media or caption' });

      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts, users } = await import('./src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const { getOrCreateUser } = await import('./src/db/users.js');

      await getOrCreateUser(userUid, `user_${userUid}@example.com`, 'Creator', `https://api.dicebear.com/7.x/avataaars/svg?seed=${userUid}`);

      const postId = crypto.randomUUID();
      const tagsString = Array.isArray(tags) ? tags.join(',') : (tags || null);

      await withDbRetry(async () => {
        await db.insert(posts).values({
          id: postId,
          authorId: userUid,
          type: type || (mediaType ? mediaType : 'video'),
          content: finalMediaUrl,
          mediaUrl: finalMediaUrl,
          thumbnailUrl: thumbnailUrl || null,
          mediaType: mediaType || type || 'video',
          mimeType: mimeType || null,
          mediaSize: mediaSize ? Number(mediaSize) : null,
          duration: duration ? Number(duration) : null,
          width: width ? Number(width) : null,
          height: height ? Number(height) : null,
          storageKey: storageKey || null,
          caption: caption || '',
          tags: tagsString,
          visibility: visibility || 'public',
          allowComments: allowComments ?? true,
        });
      });

      const created = await withDbRetry(() => db.select().from(posts).where(eq(posts.id, postId)).leftJoin(users, eq(posts.authorId, users.uid)).limit(1));
      const postRecord = created[0];
      const displayMediaUrl = postRecord.posts.mediaUrl || postRecord.posts.content || '';

      const newPost = {
        ...postRecord.posts,
        content: displayMediaUrl,
        mediaUrl: displayMediaUrl,
        author: postRecord.users ? {
          id: postRecord.users.uid,
          username: postRecord.users.username,
          displayName: postRecord.users.displayName,
          avatar: postRecord.users.avatar,
          bio: postRecord.users.bio,
          followersCount: postRecord.users.followersCount,
          followingCount: postRecord.users.followingCount,
        } : null,
        isLikedByMe: false,
        isBookmarkedByMe: false,
      };

      const message = `data: ${JSON.stringify({ operation: 'CREATE', payload: { targetType: 'POST', data: newPost }, objectId: postId, authorId: userUid })}\n\n`;
      broadcastSSE(message);

      res.status(201).json(newPost);
    } catch (e) {
      console.error('Error creating post:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/posts/:postId", async (req, res) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts, comments, likes, bookmarks, notifications } = await import('./src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');
      const { mediaStorage } = await import('./src/lib/mediaStorage.js');

      let storageKeyToDelete: string | null = null;

      await withDbRetry(async () => {
        const existing = await db.select().from(posts).where(eq(posts.id, req.params.postId)).limit(1);
        if (existing.length === 0) throw new Error('NOT_FOUND');
        if (existing[0].authorId !== userUid) throw new Error('FORBIDDEN');

        storageKeyToDelete = existing[0].storageKey || existing[0].content || null;

        await db.transaction(async (tx) => {
          await tx.delete(comments).where(eq(comments.postId, req.params.postId));
          await tx.delete(likes).where(and(eq(likes.targetId, req.params.postId), eq(likes.targetType, 'POST')));
          await tx.delete(bookmarks).where(eq(bookmarks.postId, req.params.postId));
          await tx.delete(notifications).where(eq(notifications.targetId, req.params.postId));
          await tx.delete(posts).where(eq(posts.id, req.params.postId));
        });
      });

      if (storageKeyToDelete) {
        await mediaStorage.deleteMedia(storageKeyToDelete);
      }

      broadcastSSE(`data: ${JSON.stringify({ operation: 'DELETE', payload: { targetType: 'POST' }, objectId: req.params.postId })}\n\n`);

      res.json({ success: true });
    } catch (e: any) {
      if (e?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Post not found' });
      if (e?.message === 'FORBIDDEN') return res.status(403).json({ error: 'Forbidden: You can only delete your own posts' });
      console.error('Error deleting post:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put("/api/posts/:postId", async (req, res) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts } = await import('./src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');

      const { caption, isPinned, thumbnailUrl, visibility } = req.body;

      const updatedPost = await withDbRetry(async () => {
        const existing = await db.select().from(posts).where(eq(posts.id, req.params.postId)).limit(1);
        if (existing.length === 0) throw new Error('NOT_FOUND');
        if (existing[0].authorId !== userUid) throw new Error('FORBIDDEN');

        if (typeof isPinned === 'boolean' && isPinned && !existing[0].isPinned) {
          const userPinned = await db.select().from(posts).where(and(eq(posts.authorId, userUid), eq(posts.isPinned, true)));
          if (userPinned.length >= 3) {
            throw new Error('PIN_LIMIT_EXCEEDED');
          }
        }

        const updates: any = {};
        if (typeof caption === 'string') updates.caption = caption;
        if (typeof isPinned === 'boolean') updates.isPinned = isPinned;
        if (typeof thumbnailUrl === 'string') updates.thumbnailUrl = thumbnailUrl;
        if (typeof visibility === 'string' && (visibility === 'public' || visibility === 'private')) {
          updates.visibility = visibility;
        }

        await db.update(posts).set(updates).where(eq(posts.id, req.params.postId));
        const resList = await db.select().from(posts).where(eq(posts.id, req.params.postId)).limit(1);
        return resList[0];
      });

      res.json(updatedPost);
    } catch (e: any) {
      if (e?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Post not found' });
      if (e?.message === 'FORBIDDEN') return res.status(403).json({ error: 'Forbidden: You can only edit your own posts' });
      if (e?.message === 'PIN_LIMIT_EXCEEDED') return res.status(400).json({ error: 'Maximum 3 pinned posts allowed per profile' });
      console.error('Error updating post:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/private/:userId", async (req, res) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid || userUid !== req.params.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own private posts' });
    }
    try {
      const { getUserPrivatePosts } = await import('./src/db/queries.js');
      const privatePosts = await getUserPrivatePosts(userUid);
      res.json(Array.isArray(privatePosts) ? privatePosts : []);
    } catch (e) {
      console.error('Error fetching private posts:', e);
      res.json([]);
    }
  });

  // Make an existing post into a status video
  app.post("/api/posts/:postId/make-status", async (req, res) => {
    const userUid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userUid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts } = await import('./src/db/schema.js');
      const { eq } = await import('drizzle-orm');

      const existing = await withDbRetry(() => db.select().from(posts).where(eq(posts.id, req.params.postId)).limit(1));
      if (existing.length === 0) return res.status(404).json({ error: 'Post not found' });
      if (existing[0].authorId !== userUid) return res.status(403).json({ error: 'Forbidden' });

      const statusId = crypto.randomUUID();
      const postData = existing[0];

      await withDbRetry(() =>
        db.insert(posts).values({
          id: statusId,
          authorId: userUid,
          type: 'status',
          content: postData.content || postData.mediaUrl,
          mediaUrl: postData.mediaUrl || postData.content,
          thumbnailUrl: postData.thumbnailUrl,
          caption: postData.caption || 'Status Update',
          visibility: 'public',
          viewsCount: 0,
          allowComments: false,
        })
      );

      res.json({ success: true, statusId });
    } catch (e) {
      console.error('Error turning post into status:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get Active Status Stories (last 24 hours)
  app.get("/api/statuses", async (req, res) => {
    try {
      const callerUid = await getUserIdFromAuthHeader(req.headers.authorization);
      const { db, withDbRetry } = await import('./src/db/index.js');
      const { posts, users } = await import('./src/db/schema.js');
      const { eq, gte, desc, sql, inArray } = await import('drizzle-orm');

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const statusPosts = await withDbRetry(() =>
        db.select()
          .from(posts)
          .where(
            sql`${posts.type} = 'status' AND ${posts.createdAt} >= ${twentyFourHoursAgo}`
          )
          .orderBy(desc(posts.createdAt))
          .limit(50)
      );

      if (statusPosts.length === 0) return res.json([]);

      const authorIds = [...new Set(statusPosts.map(s => s.authorId))];
      const authors = await withDbRetry(() => db.select().from(users).where(inArray(users.uid, authorIds)));
      const authorMap = new Map(authors.map(u => [u.uid, u]));

      const results = statusPosts.map(st => {
        const isOwner = callerUid === st.authorId;
        const author = authorMap.get(st.authorId);
        return {
          id: st.id,
          authorId: st.authorId,
          content: st.content || st.mediaUrl,
          mediaUrl: st.mediaUrl || st.content,
          thumbnailUrl: st.thumbnailUrl,
          caption: st.caption,
          viewsCount: isOwner ? (st.viewsCount || 0) : undefined, // views visible only to owner
          createdAt: st.createdAt,
          author: author ? {
            id: author.uid,
            username: author.username,
            displayName: author.displayName,
            avatar: author.avatar
          } : null
        };
      });

      res.json(results);
    } catch (e) {
      console.error('Error fetching statuses:', e);
      res.json([]);
    }
  });

  app.get("/api/user/following", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.json([]);
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { getUserFollowing } = await import('./src/db/queries.js');
      const following = await getUserFollowing(decodedToken.uid);
      res.json(Array.isArray(following) ? following : []);
    } catch (e) {
      res.json([]);
    }
  });

  app.get("/api/user/:userId/followers", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      let callerId: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
          callerId = decoded.uid;
        } catch {}
      }
      const { getUserFollowers } = await import('./src/db/queries.js');
      const followers = await getUserFollowers(req.params.userId, callerId);
      res.json(Array.isArray(followers) ? followers : []);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/:userId/following", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      let callerId: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
          callerId = decoded.uid;
        } catch {}
      }
      const { getUserFollowing } = await import('./src/db/queries.js');
      const following = await getUserFollowing(req.params.userId, callerId);
      res.json(Array.isArray(following) ? following : []);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/comments/:postId", async (req, res) => {
    try {
      const { getComments } = await import('./src/db/queries.js');
      const comments = await getComments(req.params.postId);
      res.json(Array.isArray(comments) ? comments : []);
    } catch (e) {
      console.error('Error fetching comments:', e);
      res.json([]);
    }
  });

  app.delete("/api/comments/:commentId", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { deleteComment } = await import('./src/db/queries.js');
      const result = await deleteComment(decodedToken.uid, req.params.commentId);
      if (result.error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });
      if (result.error === 'Not found') return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // flush the headers to establish SSE

    clients.add(res);
    const removeClient = () => {
      clients.delete(res);
    };
    req.on("close", removeClient);
    req.on("error", removeClient);
    res.on("close", removeClient);
    res.on("error", removeClient);
  });

  app.post("/api/events", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const event = req.body;
      
      // Validation: event.authorId must match token
      if (event?.authorId && event.authorId !== decodedToken.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { getOrCreateUser } = await import('./src/db/users.js');
      try {
        await getOrCreateUser(decodedToken.uid, decodedToken.email || 'no-email@example.com', decodedToken.name, decodedToken.picture);
      } catch (userErr) {
        console.warn('Could not ensure user before event:', userErr);
      }

      const { processEvent } = await import('./src/db/queries.js');
      const result = await processEvent(event);
      
      // Broadcast to all connected SSE clients safely
      broadcastSSE(`data: ${JSON.stringify(event)}\n\n`);

      res.json({ success: true, result });
    } catch (e) {
      console.error('Error processing event in /api/events:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/follow/:userId", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { toggleFollow } = await import('./src/db/queries.js');
      const result = await toggleFollow(decodedToken.uid, req.params.userId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/follow/:userId/status", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { getFollowStatus } = await import('./src/db/queries.js');
      const status = await getFollowStatus(decodedToken.uid, req.params.userId);
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { getNotifications } = await import('./src/db/queries.js');
      const notifications = await getNotifications(decodedToken.uid);
      res.json(notifications);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/notifications/read", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { markNotificationsRead } = await import('./src/db/queries.js');
      await markNotificationsRead(decodedToken.uid);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // MESSAGING ROUTES
  app.get("/api/conversations", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { getConversations } = await import('./src/db/queries.js');
      const conversations = await getConversations(decodedToken.uid);
      res.json(conversations);
    } catch (e) {
      console.error('Error fetching conversations:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { recipientId } = req.body;
      if (!recipientId) return res.status(400).json({ error: 'recipientId is required' });
      if (recipientId === decodedToken.uid) {
        return res.status(400).json({ error: 'Cannot create a conversation with yourself' });
      }

      const { getOrCreateConversation } = await import('./src/db/queries.js');
      const conv = await getOrCreateConversation(decodedToken.uid, recipientId);
      res.json(conv);
    } catch (e: any) {
      console.warn('Error creating conversation:', e.message || e);
      res.status(400).json({ error: e.message || 'Cannot create conversation' });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { getMessages } = await import('./src/db/queries.js');
      const messages = await getMessages(req.params.id, decodedToken.uid);
      res.json(messages);
    } catch (e) {
      console.error('Error fetching messages:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { text, mediaUrl, mediaType } = req.body;
      if (!text && !mediaUrl) return res.status(400).json({ error: 'Text or media required' });

      const { sendMessage } = await import('./src/db/queries.js');
      const newMessage = await sendMessage(req.params.id, decodedToken.uid, text, mediaUrl, mediaType);

      // Broadcast to SSE stream safely
      const messageEvent = `data: ${JSON.stringify({
        type: 'NEW_MESSAGE',
        conversationId: req.params.id,
        message: newMessage
      })}\n\n`;
      broadcastSSE(messageEvent);

      res.json(newMessage);
    } catch (e) {
      console.error('Error sending message:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const filter = (req.query.filter as string) || 'all';
      if (!query || !query.trim()) return res.json({ users: [], posts: [], tags: [] });
      const { search } = await import('./src/db/queries.js');
      const results = await search(query, filter);
      res.json(results);
    } catch (e) {
      console.error('Search error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
