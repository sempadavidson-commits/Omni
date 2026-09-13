export type SyncState = 'GLOBAL_ONLINE' | 'LOCAL_ONLINE' | 'PEER_AVAILABLE' | 'OFFLINE' | 'SYNCING';

export interface User {
  id: string; // our app's uid
  uid?: string;
  email?: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  lastUsernameChangeAt?: string;
  createdAt?: string;
}

export interface Post {
  id: string;
  authorId: string;
  author?: User; // attached in feed
  type: 'text' | 'image' | 'video';
  content: string; // text or url
  caption?: string;
  tags?: string;
  visibility?: 'public' | 'followers' | 'private';
  allowComments?: boolean;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: string;
  isLikedByMe?: boolean;
  isBookmarkedByMe?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  text: string;
  likesCount: number;
  createdAt: string;
  replyCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  createdAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  isGroup?: boolean;
  lastMessageText?: string;
  lastMessageAt?: string;
  createdAt: string;
  otherUser?: User;
  recipient?: User;
  unreadCount?: number;
}

export interface AppNotification {
  id: string | number;
  type: 'FOLLOW' | 'LIKE' | 'COMMENT' | 'REPOST' | 'SHARE' | 'SYSTEM';
  actorId?: string;
  recipientId: string;
  targetId?: string;
  message?: string;
  createdAt: string;
  isRead: boolean;
  actor?: User;
}

export interface PostDraft {
  id: string;
  caption: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'text';
  tags: string;
  visibility: 'public' | 'followers' | 'private';
  savedAt: string;
}
