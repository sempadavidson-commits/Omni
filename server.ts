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
      const dbUser = await getOrCreateUser(decodedToken.uid, email);

      res.json({ uid: decodedToken.uid, dbUser });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  });

  app.get("/api/feed", async (req, res) => {
    const authHeader = req.headers.authorization;
    let userId;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        userId = decodedToken.uid;
      } catch (e) {}
    }
    const { getFeed } = await import('./src/db/queries.js');
    const feed = await getFeed(userId);
    res.json(feed);
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
      if (e.message.includes('30 days')) {
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
    const { getUserPosts } = await import('./src/db/queries.js');
    const posts = await getUserPosts(req.params.userId);
    res.json(posts);
  });

  app.get("/api/comments/:postId", async (req, res) => {
    const { getComments } = await import('./src/db/queries.js');
    const comments = await getComments(req.params.postId);
    res.json(comments);
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
      
      // Basic validation: event.authorId must match token
      if (event.authorId !== decodedToken.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { getOrCreateUser } = await import('./src/db/users.js');
      await getOrCreateUser(decodedToken.uid, decodedToken.email || 'no-email@example.com', decodedToken.name, decodedToken.picture);

      const { processEvent } = await import('./src/db/queries.js');
      await processEvent(event);
      
      // Broadcast to all connected SSE clients
      const message = `data: ${JSON.stringify(event)}\n\n`;
      clients.forEach(client => client.write(message));

      res.json({ success: true });
    } catch (e) {
      console.error('Error processing event:', e);
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

  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.json({ users: [], posts: [] });
      const { search } = await import('./src/db/queries.js');
      const results = await search(query);
      res.json(results);
    } catch (e) {
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
