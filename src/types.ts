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
  following?: string[];
  isFriend?: boolean;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isFollowedByMe?: boolean;
  isFollowingMe?: boolean;
  lastUsernameChangeAt?: string;
  createdAt?: string;
}

export interface Post {
  id: string;
  authorId: string;
  author?: User; // attached in feed
  repostedBy?: User; // if shown as repost in feed
  type: 'text' | 'image' | 'video';
  content: string; // text or url
  mediaUrl?: string;
  storageKey?: string;
  mimeType?: string;
  mediaSize?: number;
  caption?: string;
  tags?: string;
  visibility?: 'public' | 'followers' | 'private';
  allowComments?: boolean;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  sharesCount: number;
  viewsCount: number;
  bookmarksCount?: number;
  savesCount?: number;
  createdAt: string;
  isLikedByMe?: boolean;
  isBookmarkedByMe?: boolean;
  isFollowedByMe?: boolean;
  isPinned?: boolean;
  thumbnailUrl?: string;
  isUploading?: boolean;
  uploadProgress?: number;
}

export interface BackgroundDownloadTask {
  id: string;
  postId: string;
  videoUrl: string;
  filename: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface BackgroundUploadTask {
  id: string;
  previewUrl: string;
  mediaType: 'video' | 'image' | 'text';
  caption: string;
  tags?: string[];
  visibility?: string;
  allowComments?: boolean;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'failed';
  error?: string;
  createdAt: string;
  resultPostId?: string;
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
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'file';
  fileName?: string;
  fileSize?: string;
  createdAt: string;
}

export interface LiveParticipant {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  role: 'host' | 'guest' | 'viewer';
  isMuted: boolean;
  isVideoEnabled: boolean;
  joinedAt: string;
}

export interface LiveMessage {
  id: string;
  liveId: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface LiveSession {
  id: string;
  hostId: string;
  host: User;
  title: string;
  category: string;
  beautyFilter?: string;
  isLive: boolean;
  viewersCount: number;
  likesCount: number;
  guests: LiveParticipant[];
  startedAt: string;
  endedAt?: string;
}

export interface UserLiveStats {
  livesDid: number;
  totalLiveViews: number;
  totalLiveLikes: number;
  totalLiveDurationSec: number;
  milestones: LiveMilestone[];
}

export interface LiveMilestone {
  id: string;
  title: string;
  description: string;
  iconName: string;
  isUnlocked: boolean;
  progress: number;
  target: number;
  unlockedAt?: string;
}

export interface Conversation {
  id: string;
  title?: string;
  isGroup?: boolean;
  lastMessage?: string;
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
