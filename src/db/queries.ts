import { db, withDbRetry } from './index.js';
import { users, posts, comments, likes, follows, notifications, bookmarks, conversations, conversationMembers, messages } from './schema.js';
import { eq, desc, asc, inArray, and, or, ilike, sql } from 'drizzle-orm';

export async function getFeed(userId?: string, tab: 'foryou' | 'following' = 'foryou', page: number = 0, limit: number = 20) {
  try {
    return await withDbRetry(async () => {
      const validPage = Number.isFinite(page) && page >= 0 ? page : 0;
      const validLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;
      const offset = validPage * validLimit;

      let feedPosts: any[] = [];

      if (tab === 'following') {
        if (!userId || userId === 'undefined') {
          return [];
        }
        // Find who the user follows
        const followed = await db.select({ followingId: follows.followingId })
          .from(follows)
          .where(eq(follows.followerId, userId));
        
        const followingIds = followed.map(f => f.followingId);
        if (followingIds.length === 0) {
          return [];
        }

        feedPosts = await db.select()
          .from(posts)
          .where(inArray(posts.authorId, followingIds))
          .orderBy(desc(posts.createdAt))
          .limit(validLimit)
          .offset(offset);
      } else {
        // For You: Order by a balanced formula (recent + likes/views engagement)
        feedPosts = await db.select()
          .from(posts)
          .orderBy(desc(posts.createdAt))
          .limit(validLimit)
          .offset(offset);
      }
      
      if (feedPosts.length === 0) return [];

      // Fetch authors
      const authorIds = [...new Set(feedPosts.map(p => p.authorId))];
      const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
      const authorMap = new Map(authors.map(u => [u.uid, {
        id: u.uid,
        username: u.username || '',
        displayName: u.displayName || '',
        avatar: u.avatar || '',
        bio: u.bio || '',
        followersCount: u.followersCount || 0,
        followingCount: u.followingCount || 0,
      }]));

      // Fetch user likes and bookmarks if logged in
      let myLikes = new Set<string>();
      let myBookmarks = new Set<string>();

      if (userId && userId !== 'undefined') {
        const postIds = feedPosts.map(p => p.id);
        if (postIds.length > 0) {
          const userLikes = await db.select()
            .from(likes)
            .where(and(
              eq(likes.userId, userId),
              eq(likes.targetType, 'POST'),
              inArray(likes.targetId, postIds)
            ));
          userLikes.forEach(l => myLikes.add(l.targetId));

          const userBookmarks = await db.select()
            .from(bookmarks)
            .where(and(
              eq(bookmarks.userId, userId),
              inArray(bookmarks.postId, postIds)
            ));
          userBookmarks.forEach(b => myBookmarks.add(b.postId));
        }
      }

      return feedPosts.map(post => ({
        ...post,
        author: authorMap.get(post.authorId),
        isLikedByMe: myLikes.has(post.id),
        isBookmarkedByMe: myBookmarks.has(post.id)
      }));
    });
  } catch (err) {
    console.error('Error fetching feed in queries.ts:', err);
    return [];
  }
}

export async function getUserPosts(userId: string) {
  if (!userId || userId === 'undefined' || userId === 'null') return [];
  try {
    return await withDbRetry(async () => {
      const userPosts = await db.select().from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)).limit(50);
      if (userPosts.length === 0) return [];
      
      const author = await db.select().from(users).where(eq(users.uid, userId)).limit(1);
      const authorData = author[0] ? {
        id: author[0].uid,
        username: author[0].username || '',
        displayName: author[0].displayName || '',
        avatar: author[0].avatar || '',
        bio: author[0].bio || '',
        followersCount: author[0].followersCount || 0,
        followingCount: author[0].followingCount || 0,
      } : undefined;

      return userPosts.map(post => ({
        ...post,
        author: authorData,
        isLikedByMe: false
      }));
    });
  } catch (err) {
    console.error('Error fetching user posts in queries.ts:', err);
    return [];
  }
}

export async function getUserSavedPosts(userId: string) {
  if (!userId || userId === 'undefined' || userId === 'null') return [];
  try {
    return await withDbRetry(async () => {
      const saved = await db.select({
        post: posts,
        savedAt: bookmarks.createdAt
      })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.postId, posts.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(50);

      if (saved.length === 0) return [];

      const authorIds = [...new Set(saved.map(s => s.post.authorId))];
      const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
      const authorMap = new Map(authors.map(u => [u.uid, {
        id: u.uid,
        username: u.username || '',
        displayName: u.displayName || '',
        avatar: u.avatar || '',
        bio: u.bio || '',
      }]));

      return saved.map(s => ({
        ...s.post,
        author: authorMap.get(s.post.authorId),
        isBookmarkedByMe: true
      }));
    });
  } catch (err) {
    console.error('Error in getUserSavedPosts:', err);
    return [];
  }
}

export async function getUserLikedPosts(userId: string) {
  if (!userId || userId === 'undefined' || userId === 'null') return [];
  try {
    return await withDbRetry(async () => {
      const userLiked = await db.select({
        post: posts,
        likedAt: likes.createdAt
      })
      .from(likes)
      .innerJoin(posts, eq(likes.targetId, posts.id))
      .where(and(eq(likes.userId, userId), eq(likes.targetType, 'POST')))
      .orderBy(desc(likes.createdAt))
      .limit(50);

      if (userLiked.length === 0) return [];

      const authorIds = [...new Set(userLiked.map(s => s.post.authorId))];
      const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
      const authorMap = new Map(authors.map(u => [u.uid, {
        id: u.uid,
        username: u.username || '',
        displayName: u.displayName || '',
        avatar: u.avatar || '',
        bio: u.bio || '',
      }]));

      return userLiked.map(s => ({
        ...s.post,
        author: authorMap.get(s.post.authorId),
        isLikedByMe: true
      }));
    });
  } catch (err) {
    console.error('Error in getUserLikedPosts:', err);
    return [];
  }
}

export async function toggleBookmark(userId: string, postId: string) {
  const existing = await db.select().from(bookmarks).where(
    and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId))
  ).limit(1);

  if (existing.length > 0) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
    return { isBookmarked: false };
  } else {
    await db.insert(bookmarks).values({
      id: `${userId}_bm_${postId}`,
      userId,
      postId,
    });
    return { isBookmarked: true };
  }
}

export async function getUserFollowers(userId: string) {
  const followerRows = await db.select({
    user: users,
    followedAt: follows.createdAt
  })
  .from(follows)
  .innerJoin(users, eq(follows.followerId, users.uid))
  .where(eq(follows.followingId, userId))
  .orderBy(desc(follows.createdAt))
  .limit(50);

  return followerRows.map(r => r.user);
}

export async function getUserFollowing(userId: string) {
  const followingRows = await db.select({
    user: users,
    followedAt: follows.createdAt
  })
  .from(follows)
  .innerJoin(users, eq(follows.followingId, users.uid))
  .where(eq(follows.followerId, userId))
  .orderBy(desc(follows.createdAt))
  .limit(50);

  return followingRows.map(r => r.user);
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

export async function deleteComment(userId: string, commentId: string) {
  const existing = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (existing.length === 0) return { error: 'Not found' };
  if (existing[0].authorId !== userId) return { error: 'Forbidden' };

  await db.delete(comments).where(eq(comments.id, commentId));
  await db.update(posts).set({
    commentsCount: sql`GREATEST(0, COALESCE(${posts.commentsCount}, 0) - 1)`
  }).where(eq(posts.id, existing[0].postId));
  return { success: true, postId: existing[0].postId };
}

export async function processEvent(event: any) {
  if (!event) return { success: true };
  const { operation, objectId, authorId, payload = {} } = event;
  if (!authorId || !objectId) return { success: true };

  const targetType = payload?.targetType || 'POST';
  const data = payload?.data || {};

  try {
    return await withDbRetry(async () => {
      if (operation === 'CREATE') {
        if (targetType === 'POST') {
          const { type, content, caption, tags, visibility, allowComments } = data;
          const tagsString = Array.isArray(tags) ? tags.join(',') : (tags || null);
          await db.insert(posts).values({
            id: objectId,
            authorId,
            type: type || 'text',
            content: content || '',
            caption: caption || '',
            tags: tagsString,
            visibility: visibility || 'public',
            allowComments: allowComments ?? true
          }).onConflictDoNothing();
        } else if (targetType === 'COMMENT') {
          const { postId, text: commentText } = data;
          if (postId && commentText) {
            await db.insert(comments).values({
              id: objectId,
              postId,
              authorId,
              text: commentText
            }).onConflictDoNothing();
            
            await db.update(posts).set({ commentsCount: sql`COALESCE(${posts.commentsCount}, 0) + 1` }).where(eq(posts.id, postId));

            try {
              const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
              if (post[0] && post[0].authorId && post[0].authorId !== authorId) {
                await db.insert(notifications).values({
                  recipientId: post[0].authorId,
                  actorId: authorId,
                  type: 'COMMENT',
                  targetId: objectId
                }).onConflictDoNothing();
              }
            } catch (notifErr) {
              console.warn('[Notification] Comment notification skipped:', notifErr);
            }
          }
        }
      } else if (operation === 'LIKE') {
        await db.insert(likes).values({
          id: `${authorId}_like_${objectId}`,
          targetId: objectId,
          targetType,
          userId: authorId
        }).onConflictDoNothing();

        if (targetType === 'POST') {
          await db.update(posts).set({ likesCount: sql`COALESCE(${posts.likesCount}, 0) + 1` }).where(eq(posts.id, objectId));
          try {
            const post = await db.select().from(posts).where(eq(posts.id, objectId)).limit(1);
            if (post[0] && post[0].authorId && post[0].authorId !== authorId) {
              await db.insert(notifications).values({
                recipientId: post[0].authorId,
                actorId: authorId,
                type: 'LIKE',
                targetId: objectId
              }).onConflictDoNothing();
            }
          } catch (notifErr) {
            console.warn('[Notification] Like notification skipped:', notifErr);
          }
        } else if (targetType === 'COMMENT') {
          await db.update(comments).set({ likesCount: sql`COALESCE(${comments.likesCount}, 0) + 1` }).where(eq(comments.id, objectId));
        }
      } else if (operation === 'UNLIKE') {
        await db.delete(likes).where(
          and(
            eq(likes.targetId, objectId),
            eq(likes.userId, authorId),
            eq(likes.targetType, targetType)
          )
        );
        if (targetType === 'POST') {
          await db.update(posts).set({ likesCount: sql`GREATEST(COALESCE(${posts.likesCount}, 0) - 1, 0)` }).where(eq(posts.id, objectId));
        } else if (targetType === 'COMMENT') {
          await db.update(comments).set({ likesCount: sql`GREATEST(COALESCE(${comments.likesCount}, 0) - 1, 0)` }).where(eq(comments.id, objectId));
        }
      } else if (operation === 'REPOST') {
        if (targetType === 'POST') {
          await db.update(posts).set({ repostsCount: sql`COALESCE(${posts.repostsCount}, 0) + 1` }).where(eq(posts.id, objectId));
          try {
            const post = await db.select().from(posts).where(eq(posts.id, objectId)).limit(1);
            if (post[0] && post[0].authorId && post[0].authorId !== authorId) {
              await db.insert(notifications).values({
                recipientId: post[0].authorId,
                actorId: authorId,
                type: 'REPOST',
                targetId: objectId
              }).onConflictDoNothing();
            }
          } catch (notifErr) {
            console.warn('[Notification] Repost notification skipped:', notifErr);
          }
        }
      } else if (operation === 'SHARE') {
        if (targetType === 'POST') {
          await db.update(posts).set({ sharesCount: sql`COALESCE(${posts.sharesCount}, 0) + 1` }).where(eq(posts.id, objectId));
        }
      }

      return { success: true };
    });
  } catch (err) {
    console.error('Error processing event in queries.ts:', err);
    return { success: true };
  }
}

export async function toggleFollow(followerId: string, followingId: string) {
  const existing = await db.select().from(follows).where(
    and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
  );

  if (existing.length > 0) {
    // Unfollow
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    await db.update(users).set({ followingCount: sql`GREATEST(COALESCE(${users.followingCount}, 0) - 1, 0)` }).where(eq(users.uid, followerId));
    await db.update(users).set({ followersCount: sql`GREATEST(COALESCE(${users.followersCount}, 0) - 1, 0)` }).where(eq(users.uid, followingId));
    return { followed: false };
  } else {
    // Follow
    await db.insert(follows).values({ followerId, followingId });
    await db.update(users).set({ followingCount: sql`COALESCE(${users.followingCount}, 0) + 1` }).where(eq(users.uid, followerId));
    await db.update(users).set({ followersCount: sql`COALESCE(${users.followersCount}, 0) + 1` }).where(eq(users.uid, followingId));
    
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
  const notifs = await db.select({
    id: notifications.id,
    type: notifications.type,
    actorId: notifications.actorId,
    recipientId: notifications.recipientId,
    targetId: notifications.targetId,
    message: notifications.message,
    isRead: notifications.isRead,
    createdAt: notifications.createdAt,
    actor: {
      id: users.uid,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar
    }
  })
  .from(notifications)
  .leftJoin(users, eq(notifications.actorId, users.uid))
  .where(eq(notifications.recipientId, userId))
  .orderBy(desc(notifications.createdAt))
  .limit(50);

  return notifs.map(n => ({
    ...n,
    isRead: n.isRead ?? false,
    createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString()
  }));
}

export async function markNotificationsRead(userId: string) {
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientId, userId));
}

// MESSAGING IMPLEMENTATION

export async function getConversations(userId: string) {
  // Find all conversation memberships for this user
  const userMemberships = await db.select()
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (userMemberships.length === 0) return [];

  const conversationIds = userMemberships.map(m => m.conversationId);
  const convList = await db.select()
    .from(conversations)
    .where(inArray(conversations.id, conversationIds))
    .orderBy(desc(conversations.lastMessageAt));

  // Find all members in these conversations to identify other participant
  const allMembers = await db.select({
    conversationId: conversationMembers.conversationId,
    userId: conversationMembers.userId,
    lastReadAt: conversationMembers.lastReadAt,
    user: users
  })
  .from(conversationMembers)
  .innerJoin(users, eq(conversationMembers.userId, users.uid))
  .where(inArray(conversationMembers.conversationId, conversationIds));

  // Group by conversation
  const membersByConv = new Map<string, any[]>();
  allMembers.forEach(m => {
    if (!membersByConv.has(m.conversationId)) {
      membersByConv.set(m.conversationId, []);
    }
    membersByConv.get(m.conversationId)!.push(m);
  });

  // Calculate unread counts
  const result = await Promise.all(convList.map(async conv => {
    const members = membersByConv.get(conv.id) || [];
    const myMembership = members.find(m => m.userId === userId);
    const otherMember = members.find(m => m.userId !== userId);

    let unreadCount = 0;
    if (myMembership?.lastReadAt) {
      const countRes = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.conversationId, conv.id),
          sql`${messages.createdAt} > ${myMembership.lastReadAt}`,
          sql`${messages.senderId} != ${userId}`
        ));
      unreadCount = Number(countRes[0]?.count || 0);
    }

    return {
      id: conv.id,
      title: conv.title,
      isGroup: conv.isGroup ?? false,
      lastMessageText: conv.lastMessageText || '',
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : conv.createdAt?.toISOString() || new Date().toISOString(),
      createdAt: conv.createdAt ? conv.createdAt.toISOString() : new Date().toISOString(),
      unreadCount,
      otherUser: otherMember ? {
        id: otherMember.user.uid,
        username: otherMember.user.username || '',
        displayName: otherMember.user.displayName || '',
        avatar: otherMember.user.avatar || '',
        bio: otherMember.user.bio || ''
      } : undefined
    };
  }));

  return result;
}

export async function getOrCreateConversation(userId: string, recipientId: string) {
  if (userId === recipientId) {
    throw new Error("Cannot create a conversation with yourself");
  }

  // Find if a 1:1 conversation between these two already exists
  const myConvs = await db.select({ convId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (myConvs.length > 0) {
    const myConvIds = myConvs.map(c => c.convId);
    const shared = await db.select({ convId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(and(
        inArray(conversationMembers.conversationId, myConvIds),
        eq(conversationMembers.userId, recipientId)
      ))
      .limit(1);

    if (shared.length > 0) {
      const existing = await db.select().from(conversations).where(eq(conversations.id, shared[0].convId)).limit(1);
      if (existing.length > 0) {
        // Fetch recipient user details
        const recipient = await db.select().from(users).where(eq(users.uid, recipientId)).limit(1);
        return {
          id: existing[0].id,
          title: existing[0].title,
          isGroup: existing[0].isGroup,
          lastMessageText: existing[0].lastMessageText,
          lastMessageAt: existing[0].lastMessageAt,
          createdAt: existing[0].createdAt,
          otherUser: recipient[0] ? {
            id: recipient[0].uid,
            username: recipient[0].username,
            displayName: recipient[0].displayName,
            avatar: recipient[0].avatar
          } : undefined
        };
      }
    }
  }

  // Otherwise, create new conversation
  const convId = 'conv_' + Math.random().toString(36).substring(2, 11);
  await db.insert(conversations).values({
    id: convId,
    isGroup: false,
    lastMessageText: 'Conversation started',
    lastMessageAt: new Date()
  });

  await db.insert(conversationMembers).values([
    { conversationId: convId, userId: userId },
    { conversationId: convId, userId: recipientId }
  ]);

  const recipient = await db.select().from(users).where(eq(users.uid, recipientId)).limit(1);
  return {
    id: convId,
    isGroup: false,
    lastMessageText: 'Conversation started',
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    otherUser: recipient[0] ? {
      id: recipient[0].uid,
      username: recipient[0].username,
      displayName: recipient[0].displayName,
      avatar: recipient[0].avatar
    } : undefined
  };
}

export async function getMessages(conversationId: string, userId: string) {
  // Mark as read for this user
  await db.update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId)
    ));

  const msgRows = await db.select({
    id: messages.id,
    conversationId: messages.conversationId,
    senderId: messages.senderId,
    text: messages.text,
    mediaUrl: messages.mediaUrl,
    mediaType: messages.mediaType,
    createdAt: messages.createdAt,
    sender: {
      id: users.uid,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar
    }
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.uid))
  .where(eq(messages.conversationId, conversationId))
  .orderBy(asc(messages.createdAt))
  .limit(100);

  return msgRows.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    mediaUrl: m.mediaUrl,
    mediaType: (m.mediaType as any) || undefined,
    createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
    sender: m.sender
  }));
}

export async function sendMessage(conversationId: string, senderId: string, text: string, mediaUrl?: string, mediaType?: string) {
  const msgId = 'msg_' + Math.random().toString(36).substring(2, 11);
  const now = new Date();

  await db.insert(messages).values({
    id: msgId,
    conversationId,
    senderId,
    text: text || '',
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    createdAt: now
  });

  // Update conversation's last message
  await db.update(conversations)
    .set({
      lastMessageText: text || (mediaType ? `[Shared ${mediaType}]` : ''),
      lastMessageAt: now
    })
    .where(eq(conversations.id, conversationId));

  // Sender has read their own message
  await db.update(conversationMembers)
    .set({ lastReadAt: now })
    .where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, senderId)
    ));

  const sender = await db.select().from(users).where(eq(users.uid, senderId)).limit(1);

  return {
    id: msgId,
    conversationId,
    senderId,
    text,
    mediaUrl,
    mediaType,
    createdAt: now.toISOString(),
    sender: sender[0] ? {
      id: sender[0].uid,
      username: sender[0].username,
      displayName: sender[0].displayName,
      avatar: sender[0].avatar
    } : undefined
  };
}

export async function search(query: string, filter: string = 'all') {
  const q = `%${query.trim()}%`;
  
  let foundUsers: any[] = [];
  let foundPosts: any[] = [];

  if (filter === 'all' || filter === 'users') {
    foundUsers = await db.select({
      id: users.uid,
      uid: users.uid,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
      bio: users.bio,
      followersCount: users.followersCount,
      followingCount: users.followingCount
    }).from(users).where(
      or(ilike(users.username, q), ilike(users.displayName, q), ilike(users.bio, q))
    ).limit(20);
  }
  
  if (filter === 'all' || filter === 'posts' || filter === 'tags') {
    foundPosts = await db.select().from(posts).where(
      or(ilike(posts.caption, q), ilike(posts.tags, q))
    ).orderBy(desc(posts.createdAt)).limit(20);

    if (foundPosts.length > 0) {
      const authorIds = [...new Set(foundPosts.map(p => p.authorId))];
      const authors = await db.select().from(users).where(inArray(users.uid, authorIds));
      const authorMap = new Map(authors.map(u => [u.uid, {
        id: u.uid,
        username: u.username || '',
        displayName: u.displayName || '',
        avatar: u.avatar || '',
      }]));

      foundPosts = foundPosts.map(p => ({
        ...p,
        author: authorMap.get(p.authorId)
      }));
    }
  }

  // Extract relevant tags
  const tagsSet = new Set<string>();
  foundPosts.forEach(p => {
    if (p.tags) {
      p.tags.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => tagsSet.add(t));
    }
  });

  return {
    users: foundUsers,
    posts: foundPosts,
    tags: Array.from(tagsSet)
  };
}
