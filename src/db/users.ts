import { db } from './index.js';
import { users } from './schema.js';

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
