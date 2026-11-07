import { create } from 'zustand';

const QUEUE_KEY = 'offlineSyncQueue';

type SyncSender = (action: string, data: unknown) => Promise<void>;

interface QueueItem {
  id: string;
  action: string;
  data: unknown;
  createdAt: string;
}

interface SyncStore {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  initialized: boolean;
  sender: SyncSender | null;
  setSender: (sender: SyncSender) => void;
  initialize: () => void;
  enqueue: (action: string, data: unknown) => Promise<{ queued: boolean }>;
  flush: () => Promise<void>;
}

const readQueue = (): QueueItem[] => {
  try {
    const value = localStorage.getItem(QUEUE_KEY);
    const queue = value ? JSON.parse(value) : [];
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueueItem[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  online: navigator.onLine,
  syncing: false,
  pendingCount: readQueue().length,
  initialized: false,
  sender: null,

  setSender: sender => set({ sender }),

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    window.addEventListener('online', () => {
      set({ online: true });
      void get().flush();
    });
    window.addEventListener('offline', () => set({ online: false }));
    window.addEventListener('focus', () => void get().flush());
    window.setInterval(() => void get().flush(), 30000);
    void get().flush();
  },

  enqueue: async (action, data) => {
    const item: QueueItem = {
      id: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      action,
      data,
      createdAt: new Date().toISOString(),
    };
    const queue = [...readQueue(), item];
    writeQueue(queue);
    set({ pendingCount: queue.length });

    await get().flush();
    return { queued: readQueue().some(queuedItem => queuedItem.id === item.id) };
  },

  flush: async () => {
    const { sender, syncing } = get();
    if (!sender || syncing || !navigator.onLine) return;

    set({ syncing: true, online: true });
    try {
      while (true) {
        const queue = readQueue();
        const item = queue[0];
        if (!item || !navigator.onLine) break;

        try {
          await sender(item.action, item.data);
        } catch {
          set({ online: navigator.onLine });
          break;
        }

        const remaining = readQueue().filter(queuedItem => queuedItem.id !== item.id);
        writeQueue(remaining);
        set({ pendingCount: remaining.length });
      }
    } finally {
      set({ syncing: false });
    }
  },
}));
