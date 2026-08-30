import { Transport, TransportAvailability } from './transport';
import { SocialEvent } from '../domain/event';
import { SyncState } from '../types';

/**
 * A mock transport that simulates varying network conditions
 * to demonstrate the Sync Engine's adaptive routing.
 */
export class MockAdaptiveTransport implements Transport {
  id = 'mock-adaptive';
  name = 'Global API';
  private currentAvailability: TransportAvailability = 'HIGH';
  private receiveCallback?: (event: SocialEvent) => void;

  // Sync state mapping for demo purposes
  setSimulatedState(state: SyncState) {
    switch (state) {
      case 'GLOBAL_ONLINE':
        this.name = 'Global Cloud CDN';
        this.currentAvailability = 'HIGH';
        break;
      case 'LOCAL_ONLINE':
        this.name = 'Local Edge Node';
        this.currentAvailability = 'HIGH';
        break;
      case 'PEER_AVAILABLE':
        this.name = 'P2P Bluetooth/LAN';
        this.currentAvailability = 'MEDIUM';
        break;
      case 'OFFLINE':
      case 'SYNCING':
        this.currentAvailability = 'NONE';
        break;
    }
  }

  async discover(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async send(event: SocialEvent): Promise<void> {
    if (this.currentAvailability === 'NONE') {
      throw new Error("Network unavailable");
    }
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`[${this.name}] Successfully delivered event: ${event.operation} on ${event.objectId}`);
  }

  receive(callback: (event: SocialEvent) => void): void {
    this.receiveCallback = callback;
  }

  availability(): TransportAvailability {
    return this.currentAvailability;
  }

  cost(): number {
    return this.name.includes('P2P') ? 0 : this.name.includes('Edge') ? 1 : 5;
  }
}
