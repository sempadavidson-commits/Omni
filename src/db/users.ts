import { db } from './index.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string, avatar?: string) {
  const result = await db.insert(users)
    .values({
      uid,
      email,
      displayName: displayName || 'New User',
      username: 'user_' + Math.random().toString(36).substring(2, 8),
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { email }, // We only update email on conflict, leaving other profile fields intact
    })
    .returning();
  return result[0];
}

export async function getUserProfile(uid: string) {
  const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (!result || result.length === 0) return null;
  return result[0];
}

export async function updateUserProfile(uid: string, data: { displayName?: string, username?: string, avatar?: string, bio?: string }) {
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
}
