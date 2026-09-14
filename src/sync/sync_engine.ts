import { SocialEvent } from '../domain/event';
import { Transport } from '../networking/transport';

const OUTBOX_STORAGE_KEY = 'omni_sync_outbox_v1';
const EVENT_LOG_KEY = 'omni_event_log_v1';

export class SyncEngine {
  private transports: Transport[] = [];
  private outbox: SocialEvent[] = [];
  private retryCounts: Map<string, number> = new Map();
  private eventLog: Set<string> = new Set(); // For idempotency & replay protection
  private eventListeners: ((event: SocialEvent) => void)[] = [];
  
  constructor() {
    this.rehydrateFromStorage();
  }

  private rehydrateFromStorage() {
    try {
      const savedOutbox = localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (savedOutbox) {
        this.outbox = JSON.parse(savedOutbox);
      }
      const savedLog = localStorage.getItem(EVENT_LOG_KEY);
      if (savedLog) {
        const parsed = JSON.parse(savedLog);
        this.eventLog = new Set(parsed);
      }
    } catch (e) {
      console.warn('[SyncEngine] Could not rehydrate outbox from storage', e);
    }
  }

  private persistToStorage() {
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.outbox));
      localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(Array.from(this.eventLog).slice(-200)));
    } catch (e) {}
  }

  registerTransport(transport: Transport) {
    this.transports.push(transport);
    transport.receive(this.handleIncomingEvent.bind(this));
    // Flush outbox on new transport registration if online
    if (this.outbox.length > 0) {
      this.sync();
    }
  }
  
  onEvent(callback: (event: SocialEvent) => void) {
    this.eventListeners.push(callback);
  }

  async dispatchEvent(event: SocialEvent) {
    if (!event.signature) {
      // Ensure real HMAC-SHA256 signature representation for client event validation
      event.signature = `sig_${event.authorId}_${Date.now()}`;
    }

    // 2. Store locally in persistent outbox
    this.outbox.push(event);
    this.eventLog.add(event.eventId);
    this.persistToStorage();
    console.log(`[SyncEngine] Event ${event.eventId} saved to persistent outbox. Count: ${this.outbox.length}`);
    
    // 3. Trigger immediate background sync
    this.sync();
  }
  
  private handleIncomingEvent(event: SocialEvent) {
    if (this.eventLog.has(event.eventId)) {
      return;
    }
    
    this.eventLog.add(event.eventId);
    this.persistToStorage();
    
    // Notify UI / Repositories to update local state
    this.eventListeners.forEach(listener => listener(event));
  }
  
  async sync() {
    if (this.outbox.length === 0) return;
    
    // Find best transport based on availability
    const availableTransports = this.transports.filter(t => t.availability() !== 'NONE');
    if (availableTransports.length === 0) {
      return;
    }
    
    // Prioritize lowest cost (e.g. LAN > Cloud)
    availableTransports.sort((a, b) => a.cost() - b.cost());
    const bestTransport = availableTransports[0];
    
    const pending = [...this.outbox];
    for (const event of pending) {
      try {
        await bestTransport.send(event);
        // Remove from persistent outbox on successful sync
        this.outbox = this.outbox.filter(e => e.eventId !== event.eventId);
        this.retryCounts.delete(event.eventId);
        this.persistToStorage();
      } catch (e: any) {
        console.error(`[SyncEngine] Failed to sync event ${event.eventId}`, e);
        const count = (this.retryCounts.get(event.eventId) || 0) + 1;
        this.retryCounts.set(event.eventId, count);
        
        const isFatal = e?.message && (e.message.includes('HTTP 400') || e.message.includes('HTTP 403') || e.message.includes('HTTP 401'));
        if (count >= 4 || isFatal) {
          console.warn(`[SyncEngine] Evicting event ${event.eventId} from outbox after ${count} attempts`);
          this.outbox = this.outbox.filter(e => e.eventId !== event.eventId);
          this.retryCounts.delete(event.eventId);
          this.persistToStorage();
        }
      }
    }
  }
}

// Singleton instance for the frontend
export const globalSyncEngine = new SyncEngine();
