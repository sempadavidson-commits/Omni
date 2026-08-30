export type SyncState = 'GLOBAL_ONLINE' | 'LOCAL_ONLINE' | 'PEER_AVAILABLE' | 'OFFLINE' | 'SYNCING';

export interface User {
  id: string; // our app's uid
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  followers?: number;
  following?: number;
}

export interface Post {
  id: string;
  authorId: string;
  author?: User; // attached in feed
  type: 'text' | 'image' | 'video';
  content: string; // text or url
  caption?: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: string;
  isLikedByMe?: boolean;
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

export interface Conversation {
  id: string;
  participantId: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  actorId: string;
  targetId?: string;
  createdAt: string;
  read: boolean;
}
