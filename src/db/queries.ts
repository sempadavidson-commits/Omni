import { db } from './index.js';
import { users, posts, comments, likes } from './schema.js';
import { eq, desc, inArray, and } from 'drizzle-orm';

export async function getFeed(userId?: string) {
  // Fetch posts ordered by latest
  const recentPosts = await db.select().from(posts).orderBy(desc(posts.createdAt)).limit(50);
  
  if (recentPosts.length === 0) return [];

  // Fetch authors
  const authorIds = [...new Set(recentPosts.map(p => p.authorId))];
  const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
  const authorMap = new Map(authors.map(u => [u.uid, {
    id: u.uid,
    username: u.username || '',
    displayName: u.displayName || '',
    avatar: u.avatar || '',
    bio: u.bio || '',
  }]));

  // Fetch likes if user is logged in
  let myLikes = new Set<string>();
  if (userId) {
    const postIds = recentPosts.map(p => p.id);
    const userLikes = await db.select()
      .from(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.targetType, 'POST'),
        inArray(likes.targetId, postIds)
      ));
    userLikes.forEach(l => myLikes.add(l.targetId));
  }

  return recentPosts.map(post => ({
    ...post,
    author: authorMap.get(post.authorId),
    isLikedByMe: myLikes.has(post.id)
  }));
}

export async function getComments(postId: string) {
  const postComments = await db.select().from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt))
    .limit(50);

  if (postComments.length === 0) return [];
  
  const authorIds = [...new Set(postComments.map(c => c.authorId))];
  const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
  const authorMap = new Map(authors.map(u => [u.uid, {
    id: u.uid,
    username: u.username || '',
    displayName: u.displayName || '',
    avatar: u.avatar || '',
    bio: u.bio || '',
  }]));

  return postComments.map(c => ({
    ...c,
    author: authorMap.get(c.authorId),
  }));
}

export async function processEvent(event: any) {
  const { operation, objectId, authorId, payload } = event;
  
  try {
    if (operation === 'CREATE') {
      if (payload.targetType === 'POST') {
        const { type, content, caption } = payload.data;
        await db.insert(posts).values({
          id: objectId,
          authorId,
          type: type || 'text',
          content: content || '',
          caption: caption || ''
        }).onConflictDoNothing();
      } else if (payload.targetType === 'COMMENT') {
        const { postId, text } = payload.data;
        await db.insert(comments).values({
          id: objectId,
          postId,
          authorId,
          text: text
        }).onConflictDoNothing();
      }
    } else if (operation === 'LIKE') {
      const targetType = payload.targetType || 'POST';
      await db.insert(likes).values({
        id: `${authorId}_like_${objectId}`,
        targetId: objectId,
        targetType,
        userId: authorId
      }).onConflictDoNothing();
      
      // Update counters (simple way, normally we'd use a trigger or transaction)
      // We will skip strict counters in this prototype for simplicity, client handles optimistically
    } else if (operation === 'UNLIKE') {
      const targetType = payload.targetType || 'POST';
      await db.delete(likes).where(
        and(
          eq(likes.targetId, objectId),
          eq(likes.userId, authorId),
          eq(likes.targetType, targetType)
        )
      );
    }
  } catch (err) {
    console.error('Error processing event:', err);
    throw err;
  }
}
