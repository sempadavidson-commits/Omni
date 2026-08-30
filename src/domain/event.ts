export type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'LIKE' | 'UNLIKE' | 'REPOST';

export interface SocialEvent<T = any> {
  eventId: string;
  authorId: string;
  deviceId: string;
  objectId: string;
  operation: Operation;
  hlc: string; // Hybrid Logical Clock timestamp
  payload: T;
  signature: string;
}
