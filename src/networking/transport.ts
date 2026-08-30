import { SocialEvent } from '../domain/event';

export type TransportAvailability = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface Transport {
  id: string;
  name: string;
  
  discover(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  send(event: SocialEvent): Promise<void>;
  receive(callback: (event: SocialEvent) => void): void;
  
  availability(): TransportAvailability;
  cost(): number; // 0 = free (LAN), 1 = cheap, 10 = expensive cellular
}
