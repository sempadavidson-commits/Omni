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

  app.get("/api/comments/:postId", async (req, res) => {
    const { getComments } = await import('./src/db/queries.js');
    const comments = await getComments(req.params.postId);
    res.json(comments);
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
      res.json({ success: true });
    } catch (e) {
      console.error('Error processing event:', e);
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
