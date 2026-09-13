/**
 * Omni Recommendation Signal & Telemetry Engine
 * Foundation for real user interaction signals:
 * - impression/view
 * - watch time (ms)
 * - video completion
 * - skip (< 2s watch time before scrolling)
 * - like / unlike
 * - comment
 * - share
 * - save / bookmark
 * - follow
 * - profile visit
 */

export interface InteractionSignal {
  type:
    | 'impression'
    | 'view'
    | 'watch_time'
    | 'completion'
    | 'skip'
    | 'like'
    | 'unlike'
    | 'comment'
    | 'share'
    | 'save'
    | 'follow'
    | 'profile_visit';
  postId?: string;
  creatorId?: string;
  watchTimeMs?: number;
  videoDurationSec?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'omni_interaction_signals_queue';
const MAX_QUEUE_SIZE = 100;

class TelemetryService {
  private queue: InteractionSignal[] = [];

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored).slice(-MAX_QUEUE_SIZE);
      }
    } catch {}
  }

  public track(signal: Omit<InteractionSignal, 'timestamp'>): void {
    const fullSignal: InteractionSignal = {
      ...signal,
      timestamp: new Date().toISOString()
    };

    this.queue.push(fullSignal);
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.shift();
    }

    this.persist();

    // Optionally forward to server if an analytics endpoint is ready
    if (navigator.onLine && this.queue.length >= 10) {
      this.flush();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {}
  }

  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    try {
      // Send interaction signals batch if backend analytics receiver exists
      fetch('/api/telemetry/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: batch })
      }).catch(() => {});
      this.queue = [];
      this.persist();
    } catch {}
  }
}

export const telemetry = new TelemetryService();
