import { db, withDbRetry } from './index.js';
import { users } from './schema.js';
import { eq, or } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string, avatar?: string) {
  return withDbRetry(async () => {
    if (!uid) throw new Error('User UID is required');
    
    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing && existing.length > 0) {
      return existing[0];
    }

    const cleanEmail = email || `user_${uid}@example.com`;
    const cleanDisplayName = displayName || 'New User';
    const cleanAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    const cleanUsername = 'user_' + Math.random().toString(36).substring(2, 8) + Math.floor(Math.random() * 1000);

    const inserted = await db.insert(users)
      .values({
        uid,
        email: cleanEmail,
        displayName: cleanDisplayName,
        username: cleanUsername,
        avatar: cleanAvatar,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted && inserted.length > 0) {
      return inserted[0];
    }

    // If conflict occurred, re-fetch
    const fallback = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return fallback[0] || null;
  });
}

export async function getUserProfile(identifier: string) {
  if (!identifier || identifier === 'undefined' || identifier === 'null') return null;
  return withDbRetry(async () => {
    const result = await db.select().from(users).where(
      or(
        eq(users.uid, identifier),
        eq(users.username, identifier),
        eq(users.email, identifier)
      )
    ).limit(1);
    if (result && result.length > 0) return result[0];

    const cleanName = identifier.startsWith('@') ? identifier.slice(1) : identifier;
    const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const newUser = await getOrCreateUser(
      identifier,
      `${cleanUsername || 'user'}@example.com`,
      cleanName,
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${identifier}`
    );
    return newUser;
  });
}

export async function updateUserProfile(uid: string, data: { displayName?: string, username?: string, avatar?: string, bio?: string }) {
  return withDbRetry(async () => {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existing || existing.length === 0) throw new Error('User not found');
    
    const user = existing[0];
    
    if (data.username && data.username !== user.username) {
      if (user.lastUsernameChangeAt) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (user.lastUsernameChangeAt > thirtyDaysAgo) {
          throw new Error('Username can only be changed once every 30 days');
        }
      }
    }

    const result = await db.update(users)
      .set({
        ...data,
        ...(data.username && data.username !== user.username ? { lastUsernameChangeAt: new Date() } : {})
      })
      .where(eq(users.uid, uid))
      .returning();
      
    return result[0];
  });
}
