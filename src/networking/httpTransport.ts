import { SocialEvent } from '../domain/event';
import { Transport, TransportAvailability } from './transport';
import { auth } from '../lib/firebase';

export class HttpTransport implements Transport {
  id = 'http-cloud';
  name = 'Cloud HTTP';
  private receiveCallback?: (event: SocialEvent) => void;
  private evtSource?: EventSource;

  async discover() {}
  
  async connect() {
    this.evtSource = new EventSource('/api/stream');
    this.evtSource.onmessage = (e) => {
      if (this.receiveCallback) {
        try {
          const event = JSON.parse(e.data);
          // Prevent echoing our own events if we have auth.currentUser.uid, although SyncEngine dedupes by ID
          this.receiveCallback(event);
        } catch (err) {
          console.error('SSE Parse Error', err);
        }
      }
    };
  }

  async disconnect() {
    if (this.evtSource) {
      this.evtSource.close();
      this.evtSource = undefined;
    }
  }

  async send(event: SocialEvent): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const token = await user.getIdToken();
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(event)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }

  receive(callback: (event: SocialEvent) => void): void {
    this.receiveCallback = callback;
  }

  availability(): TransportAvailability {
    return navigator.onLine ? 'HIGH' : 'NONE';
  }

  cost(): number {
    return 10; // Cloud transport is highest cost compared to Local/P2P
  }
}
