import { db } from './index.js';
import { users, posts, comments, likes, follows, notifications } from './schema.js';
import { eq, desc, inArray, and, or, ilike, sql } from 'drizzle-orm';

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

export async function getUserPosts(userId: string) {
  const userPosts = await db.select().from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)).limit(50);
  
  if (userPosts.length === 0) return [];
  
  const author = await db.select().from(users).where(eq(users.uid, userId)).limit(1);
  const authorData = author[0] ? {
    id: author[0].uid,
    username: author[0].username || '',
    displayName: author[0].displayName || '',
    avatar: author[0].avatar || '',
    bio: author[0].bio || '',
  } : undefined;

  return userPosts.map(post => ({
    ...post,
    author: authorData,
    isLikedByMe: false // Simplified for this view, or we could fetch likes similarly
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
        
        await db.update(posts).set({ commentsCount: sql`COALESCE(${posts.commentsCount}, 0) + 1` }).where(eq(posts.id, postId));

        const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
        if (post[0] && post[0].authorId !== authorId) {
          await db.insert(notifications).values({
            recipientId: post[0].authorId,
            actorId: authorId,
            type: 'COMMENT',
            targetId: objectId
          });
        }
      }
    } else if (operation === 'LIKE' || operation === 'REPOST' || operation === 'SHARE') {
      const targetType = payload.targetType || 'POST';
      if (operation === 'LIKE') {
        await db.insert(likes).values({
          id: `${authorId}_like_${objectId}`,
          targetId: objectId,
          targetType,
          userId: authorId
        }).onConflictDoNothing();
      }
      
      if (targetType === 'POST') {
        if (operation === 'LIKE') {
          await db.update(posts).set({ likesCount: sql`COALESCE(${posts.likesCount}, 0) + 1` }).where(eq(posts.id, objectId));
        } else if (operation === 'REPOST') {
          await db.update(posts).set({ repostsCount: sql`COALESCE(${posts.repostsCount}, 0) + 1` }).where(eq(posts.id, objectId));
        } else if (operation === 'SHARE') {
          await db.update(posts).set({ sharesCount: sql`COALESCE(${posts.sharesCount}, 0) + 1` }).where(eq(posts.id, objectId));
        }
      }
      
      if (targetType === 'POST') {
        const post = await db.select().from(posts).where(eq(posts.id, objectId)).limit(1);
        if (post[0] && post[0].authorId !== authorId) {
          await db.insert(notifications).values({
            recipientId: post[0].authorId,
            actorId: authorId,
            type: operation,
            targetId: objectId
          });
        }
      }
    } else if (operation === 'UNLIKE') {
      const targetType = payload.targetType || 'POST';
      await db.delete(likes).where(
        and(
          eq(likes.targetId, objectId),
          eq(likes.userId, authorId),
          eq(likes.targetType, targetType)
        )
      );
      if (targetType === 'POST') {
        await db.update(posts).set({ likesCount: sql`GREATEST(COALESCE(${posts.likesCount}, 0) - 1, 0)` }).where(eq(posts.id, objectId));
      }
    }
  } catch (err) {
    console.error('Error processing event:', err);
    throw err;
  }
}

export async function toggleFollow(followerId: string, followingId: string) {
  const existing = await db.select().from(follows).where(
    and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
  );

  if (existing.length > 0) {
    // Unfollow
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    await db.update(users).set({ followingCount: sql`${users.followingCount} - 1` }).where(eq(users.uid, followerId));
    await db.update(users).set({ followersCount: sql`${users.followersCount} - 1` }).where(eq(users.uid, followingId));
    return { followed: false };
  } else {
    // Follow
    await db.insert(follows).values({ followerId, followingId });
    await db.update(users).set({ followingCount: sql`${users.followingCount} + 1` }).where(eq(users.uid, followerId));
    await db.update(users).set({ followersCount: sql`${users.followersCount} + 1` }).where(eq(users.uid, followingId));
    
    // Create notification
    await db.insert(notifications).values({
      recipientId: followingId,
      actorId: followerId,
      type: 'FOLLOW',
    });
    return { followed: true };
  }
}

export async function getFollowStatus(followerId: string, followingId: string) {
  const existing = await db.select().from(follows).where(
    and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
  );
  return existing.length > 0;
}

export async function getNotifications(userId: string) {
  return await db.select({
    notification: notifications,
    actor: users,
  })
  .from(notifications)
  .leftJoin(users, eq(notifications.actorId, users.uid))
  .where(eq(notifications.recipientId, userId))
  .orderBy(desc(notifications.createdAt))
  .limit(50);
}

export async function markNotificationsRead(userId: string) {
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientId, userId));
}

export async function search(query: string) {
  const q = `%${query}%`;
  const foundUsers = await db.select().from(users).where(
    or(ilike(users.username, q), ilike(users.displayName, q))
  ).limit(10);
  
  const foundPosts = await db.select().from(posts).where(
    ilike(posts.caption, q)
  ).limit(10);
  
  return { users: foundUsers, posts: foundPosts };
}
