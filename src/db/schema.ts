import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  username: text('username').unique(),
  avatar: text('avatar'),
  bio: text('bio'),
  followersCount: integer('followers_count').default(0),
  followingCount: integer('following_count').default(0),
  lastUsernameChangeAt: timestamp('last_username_change_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey(), // using client-generated IDs for local-first sync
  authorId: text('author_id').notNull().references(() => users.uid),
  type: text('type').notNull(), // 'text', 'image', 'video'
  content: text('content'), // legacy field maintained for backward compatibility
  mediaUrl: text('media_url'),
  thumbnailUrl: text('thumbnail_url'),
  mediaType: text('media_type'),
  mimeType: text('mime_type'),
  mediaSize: integer('media_size'),
  duration: integer('duration'),
  width: integer('width'),
  height: integer('height'),
  storageKey: text('storage_key'),
  processingStatus: text('processing_status').default('completed'),
  caption: text('caption'),
  tags: text('tags'), // e.g. '#omni,#visuals'
  visibility: text('visibility').default('public'), // 'public', 'followers', 'private'
  allowComments: boolean('allow_comments').default(true),
  isPinned: boolean('is_pinned').default(false),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  repostsCount: integer('reposts_count').default(0),
  sharesCount: integer('shares_count').default(0),
  viewsCount: integer('views_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  authorIdx: index('posts_author_idx').on(table.authorId),
  createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
  isPinnedIdx: index('posts_is_pinned_idx').on(table.isPinned),
}));

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id),
  authorId: text('author_id').notNull().references(() => users.uid),
  text: text('text').notNull(),
  likesCount: integer('likes_count').default(0),
  replyCount: integer('reply_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  postIdx: index('comments_post_idx').on(table.postId),
  createdAtIdx: index('comments_created_at_idx').on(table.createdAt),
}));

export const likes = pgTable('likes', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull(),
  targetType: text('target_type').notNull(), // 'POST' or 'COMMENT'
  userId: text('user_id').notNull().references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueLike: uniqueIndex('likes_unique_idx').on(table.userId, table.targetId, table.targetType),
  userIdx: index('likes_user_idx').on(table.userId),
  targetIdx: index('likes_target_idx').on(table.targetId),
}));

export const bookmarks = pgTable('bookmarks', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueBookmark: uniqueIndex('bookmarks_unique_idx').on(table.userId, table.postId),
  userIdx: index('bookmarks_user_idx').on(table.userId),
  postIdx: index('bookmarks_post_idx').on(table.postId),
}));

export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => users.uid),
  followingId: text('following_id').notNull().references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueFollow: uniqueIndex('follows_unique_idx').on(table.followerId, table.followingId),
  followerIdx: index('follows_follower_idx').on(table.followerId),
  followingIdx: index('follows_following_idx').on(table.followingId),
}));

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  recipientId: text('recipient_id').notNull().references(() => users.uid),
  actorId: text('actor_id').references(() => users.uid),
  type: text('type').notNull(), // 'FOLLOW', 'LIKE', 'COMMENT', 'REPOST', 'SYSTEM'
  targetId: text('target_id'), // Post or Comment ID
  message: text('message'), // For SYSTEM or custom messages
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  recipientIdx: index('notifications_recipient_idx').on(table.recipientId),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(), // e.g. conv_...
  title: text('title'),
  isGroup: boolean('is_group').default(false),
  lastMessageText: text('last_message_text'),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversationMembers = pgTable('conversation_members', {
  id: serial('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  userId: text('user_id').notNull().references(() => users.uid),
  lastReadAt: timestamp('last_read_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueMember: uniqueIndex('conv_members_unique_idx').on(table.conversationId, table.userId),
}));

export const messages = pgTable('messages', {
  id: text('id').primaryKey(), // msg_...
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  senderId: text('sender_id').notNull().references(() => users.uid),
  text: text('text').notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'), // 'image', 'video', 'audio'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
}));
