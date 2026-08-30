import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  username: text('username').unique(),
  avatar: text('avatar'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey(), // using client-generated IDs for local-first sync
  authorId: text('author_id').notNull().references(() => users.uid),
  type: text('type').notNull(), // 'text', 'image', 'video'
  content: text('content'),
  caption: text('caption'),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  repostsCount: integer('reposts_count').default(0),
  sharesCount: integer('shares_count').default(0),
  viewsCount: integer('views_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id),
  authorId: text('author_id').notNull().references(() => users.uid),
  text: text('text').notNull(),
  likesCount: integer('likes_count').default(0),
  replyCount: integer('reply_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const likes = pgTable('likes', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull(),
  targetType: text('target_type').notNull(), // 'POST' or 'COMMENT'
  userId: text('user_id').notNull().references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
});
