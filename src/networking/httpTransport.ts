import { SocialEvent } from '../domain/event';
import { Transport, TransportAvailability } from './transport';
import { auth } from '../lib/firebase';

export class HttpTransport implements Transport {
  id = 'http-cloud';
  name = 'Cloud HTTP';
  private receiveCallback?: (event: SocialEvent) => void;

  async discover() {}
  async connect() {}
  async disconnect() {}

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
