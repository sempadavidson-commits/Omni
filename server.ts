import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      
      // Upsert the user into Cloud SQL
      const { getOrCreateUser } = await import('./src/db/users.js');
      const email = decodedToken.email || 'no-email@example.com';
      const dbUser = await getOrCreateUser(decodedToken.uid, email, decodedToken.name, decodedToken.picture);

      res.json({ uid: decodedToken.uid, dbUser });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
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

  app.get("/api/user/:userId", async (req, res) => {
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

  app.get("/api/posts/:postId", async (req, res) => {
    try {
      const { db } = await import('./src/db/index.js');
      const { posts, users } = await import('./src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const result = await db.select().from(posts).where(eq(posts.id, req.params.postId)).leftJoin(users, eq(posts.authorId, users.uid)).limit(1);
      if (!result || result.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ...result[0].posts, author: result[0].users });
    } catch (e) {
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

  app.post("/api/posts", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { content, caption, type, tags, visibility, allowComments } = req.body;
      if (!content && !caption) return res.status(400).json({ error: 'Post must have content or caption' });

      const { db } = await import('./src/db/index.js');
      const { posts, users } = await import('./src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const { getOrCreateUser } = await import('./src/db/users.js');

      await getOrCreateUser(decodedToken.uid, decodedToken.email || 'no-email@example.com', decodedToken.name, decodedToken.picture);

      const postId = crypto.randomUUID();
      const tagsString = Array.isArray(tags) ? tags.join(',') : (tags || null);

      await db.insert(posts).values({
        id: postId,
        authorId: decodedToken.uid,
        type: type || 'video',
        content: content || '',
        caption: caption || '',
        tags: tagsString,
        visibility: visibility || 'public',
        allowComments: allowComments ?? true,
      });

      const created = await db.select().from(posts).where(eq(posts.id, postId)).leftJoin(users, eq(posts.authorId, users.uid)).limit(1);
      const postRecord = created[0];
      const newPost = {
        ...postRecord.posts,
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

      const message = `data: ${JSON.stringify({ operation: 'CREATE', payload: { targetType: 'POST', data: newPost }, objectId: postId, authorId: decodedToken.uid })}\n\n`;
      clients.forEach(client => client.write(message));

      res.status(201).json(newPost);
    } catch (e) {
      console.error('Error creating post:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/posts/:postId", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      const { db } = await import('./src/db/index.js');
      const { posts, comments, likes, bookmarks } = await import('./src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');

      const existing = await db.select().from(posts).where(eq(posts.id, req.params.postId)).limit(1);
      if (existing.length === 0) return res.status(404).json({ error: 'Post not found' });
      if (existing[0].authorId !== decodedToken.uid) return res.status(403).json({ error: 'Forbidden' });

      await db.delete(comments).where(eq(comments.postId, req.params.postId));
      await db.delete(likes).where(and(eq(likes.targetId, req.params.postId), eq(likes.targetType, 'POST')));
      await db.delete(bookmarks).where(eq(bookmarks.postId, req.params.postId));
      await db.delete(posts).where(eq(posts.id, req.params.postId));

      res.json({ success: true });
    } catch (e) {
      console.error('Error deleting post:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/:userId/followers", async (req, res) => {
    try {
      const { getUserFollowers } = await import('./src/db/queries.js');
      const followers = await getUserFollowers(req.params.userId);
      res.json(followers);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/user/:userId/following", async (req, res) => {
    try {
      const { getUserFollowing } = await import('./src/db/queries.js');
      const following = await getUserFollowing(req.params.userId);
      res.json(following);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/comments/:postId", async (req, res) => {
    const { getComments } = await import('./src/db/queries.js');
    const comments = await getComments(req.params.postId);
    res.json(comments);
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

  // Real-time SSE connection
  const clients = new Set<express.Response>();
  
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // flush the headers to establish SSE

    clients.add(res);
    req.on("close", () => {
      clients.delete(res);
    });
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
      try {
        const message = `data: ${JSON.stringify(event)}\n\n`;
        clients.forEach(client => {
          try {
            client.write(message);
          } catch (writeErr) {
            clients.delete(client);
          }
        });
      } catch (sseErr) {
        console.warn('SSE broadcast error:', sseErr);
      }

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
      const isFollowing = await getFollowStatus(decodedToken.uid, req.params.userId);
      res.json({ isFollowing });
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

      const { getOrCreateConversation } = await import('./src/db/queries.js');
      const conv = await getOrCreateConversation(decodedToken.uid, recipientId);
      res.json(conv);
    } catch (e: any) {
      console.error('Error creating conversation:', e);
      res.status(500).json({ error: e.message || 'Internal server error' });
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

      // Broadcast to SSE stream
      const messageEvent = `data: ${JSON.stringify({
        type: 'NEW_MESSAGE',
        conversationId: req.params.id,
        message: newMessage
      })}\n\n`;
      clients.forEach(c => c.write(messageEvent));

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
