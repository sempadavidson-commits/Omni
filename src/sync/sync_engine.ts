import { SocialEvent } from '../domain/event';
import { Transport } from '../networking/transport';

export class SyncEngine {
  private transports: Transport[] = [];
  private outbox: SocialEvent[] = [];
  private eventLog: Set<string> = new Set(); // For idempotency & replay protection
  private eventListeners: ((event: SocialEvent) => void)[] = [];
  
  registerTransport(transport: Transport) {
    this.transports.push(transport);
    transport.receive(this.handleIncomingEvent.bind(this));
  }
  
  onEvent(callback: (event: SocialEvent) => void) {
    this.eventListeners.push(callback);
  }

  async dispatchEvent(event: SocialEvent) {
    // 1. Validate signature & schema (Mocked)
    if (!event.signature) throw new Error("Unsigned event");

    // 2. Store locally in outbox (Represents SQLite/IndexedDB append)
    this.outbox.push(event);
    this.eventLog.add(event.eventId);
    console.log(`[SyncEngine] Event ${event.eventId} saved locally. Outbox size: ${this.outbox.length}`);
    
    // 3. Attempt background sync
    this.sync();
  }
  
  private handleIncomingEvent(event: SocialEvent) {
    if (this.eventLog.has(event.eventId)) {
      console.log(`[SyncEngine] Duplicate event ignored: ${event.eventId}`);
      return;
    }
    
    // 1. Verify signature
    // 2. Reconcile HLC
    this.eventLog.add(event.eventId);
    console.log(`[SyncEngine] Received remote event:`, event);
    
    // Notify UI / Repositories to update local state
    this.eventListeners.forEach(listener => listener(event));
  }
  
  async sync() {
    if (this.outbox.length === 0) return;
    
    // Find best transport based on availability and cost
    const availableTransports = this.transports.filter(t => t.availability() !== 'NONE');
    if (availableTransports.length === 0) {
      console.log('[SyncEngine] No transports available. Retaining in outbox.');
      return;
    }
    
    // Prioritize lowest cost (e.g. LAN > Edge > Cloud)
    availableTransports.sort((a, b) => a.cost() - b.cost());
    const bestTransport = availableTransports[0];
    
    console.log(`[SyncEngine] Flushing outbox via ${bestTransport.name}...`);
    
    const pending = [...this.outbox];
    for (const event of pending) {
      try {
        await bestTransport.send(event);
        // Remove from outbox on successful sync
        this.outbox = this.outbox.filter(e => e.eventId !== event.eventId);
      } catch (e) {
        console.error(`[SyncEngine] Failed to send event ${event.eventId}`, e);
        // Remains in outbox for next attempt
      }
    }
  }
}

// Singleton instance for the frontend prototype
export const globalSyncEngine = new SyncEngine();
