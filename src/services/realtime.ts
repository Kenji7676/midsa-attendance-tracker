import { getAuthToken } from './api';

type SyncPayload = {
  type: 'attendance' | 'scholars' | 'events' | 'stats';
  data: any;
  timestamp: number;
};

type SyncCallback = (event: SyncPayload) => void;

class RealtimeSyncManager {
  private eventSource: EventSource | null = null;
  private listeners: Set<SyncCallback> = new Set();
  private reconnectTimeout: any = null;
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();

      // Automatically reconnect when the device wakes up or user focuses the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected || !this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
            this.reconnect(0);
          }
        }
      });

      window.addEventListener('online', () => {
        this.reconnect(0);
      });
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;

    const token = getAuthToken();
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    try {
      this.eventSource = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);

      this.eventSource.addEventListener('connected', () => {
        this.isConnected = true;
      });

      this.eventSource.addEventListener('sync', (e: MessageEvent) => {
        try {
          const payload: SyncPayload = JSON.parse(e.data);
          this.listeners.forEach((callback) => {
            try {
              callback(payload);
            } catch (err) {
              console.error('Error in realtime sync listener callback:', err);
            }
          });
        } catch (err) {
          console.error('Error parsing realtime sync payload:', err);
        }
      });

      this.eventSource.onerror = () => {
        this.isConnected = false;
        try {
          this.eventSource?.close();
        } catch {}
        this.eventSource = null;
        if (getAuthToken()) {
          this.reconnect(3000);
        }
      };
    } catch (err) {
      console.error('Failed to initialize EventSource:', err);
      if (getAuthToken()) {
        this.reconnect(4000);
      }
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  private reconnect(delayMs: number) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const realtimeSync = new RealtimeSyncManager();
