import { create } from 'zustand';
import { Nomenclature, ExpenseSheet, ChatMessage, Announcement } from '../types';
import { api } from '../api';

const readCache = <T>(key: string): T[] => {
  try {
    const value = localStorage.getItem(`cache_${key}`);
    const data = value ? JSON.parse(value) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const writeCache = (key: string, data: unknown[]) => {
  localStorage.setItem(`cache_${key}`, JSON.stringify(data));
};

interface DataStore {
  nomenclature: Nomenclature[];
  expenseSheets: ExpenseSheet[];
  messages: ChatMessage[];
  announcements: Announcement[];
  loading: boolean;
  
  loadNomenclature: () => Promise<void>;
  loadExpenseSheets: (employeeId: string) => Promise<void>;
  loadMessages: (employeeId: string) => Promise<void>;
  loadAnnouncements: () => Promise<void>;
  createExpenseSheet: (sheet: Omit<ExpenseSheet, 'id'>) => Promise<boolean>;
  updateExpenseSheet: (sheet: ExpenseSheet) => Promise<boolean>;
  sendMessage: (message: Omit<ChatMessage, 'id' | 'date'>) => Promise<boolean>;
  markMessagesAsRead: (messageIds: string[]) => Promise<void>;
  editMessage: (messageId: string, newText: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
}

export const useDataStore = create<DataStore>((set, get) => ({
  nomenclature: [],
  expenseSheets: [],
  messages: [],
  announcements: [],
  loading: false,

  loadNomenclature: async () => {
    set({ loading: true });
    const response = await api.getNomenclature();
    if (response.success && response.data) {
      writeCache('nomenclature', response.data);
      set({ nomenclature: response.data, loading: false });
    } else {
      set({ nomenclature: readCache<Nomenclature>('nomenclature'), loading: false });
    }
  },

  loadExpenseSheets: async (employeeId: string) => {
    set({ loading: true });
    const response = await api.getEmployeeExpenseSheets(employeeId);
    if (response.success && response.data) {
      writeCache(`expenseSheets_${employeeId}`, response.data);
      set({ expenseSheets: response.data, loading: false });
    } else {
      set({ expenseSheets: readCache<ExpenseSheet>(`expenseSheets_${employeeId}`), loading: false });
    }
  },

  loadMessages: async (employeeId: string) => {
    set({ loading: true });
    const response = await api.getEmployeeMessages(employeeId);
    if (response.success && response.data) {
      const serverMessages = response.data;
      set(state => {
        const locallyReadIds = new Set(
          state.messages.filter(message => message.read).map(message => message.id)
        );
        const mergedServerMessages = serverMessages.map(message =>
          locallyReadIds.has(message.id) ? { ...message, read: true } : message
        );
        const tempMessages = state.messages.filter(msg => msg.id.startsWith('temp_'));
        const allMessages = [...mergedServerMessages, ...tempMessages];
        writeCache('messages', allMessages);
        return { messages: allMessages, loading: false };
      });
    } else {
      set({ messages: readCache<ChatMessage>('messages'), loading: false });
    }
  },

  loadAnnouncements: async () => {
    set({ loading: true });
    const response = await api.getAnnouncements();
    if (response.success && response.data) {
      const normalizedAnnouncements = response.data.map((ann: any) => {
        const isActive = ann.active === true ||
                        ann.active === 'ДА' ||
                        ann['Активно'] === 'ДА' ||
                        ann['Активно'] === true ||
                        ann['Активно'] === 'true';

        return {
          ...ann,
          id: ann.id || ann['ID'] || `ann-${Math.random()}`,
          title: ann.title || ann['Заголовок'] || '',
          text: ann.text || ann['Текст'] || '',
          createdBy: ann.createdBy || ann['Кем создано'] || '',
          date: ann.date || ann['Дата'] || new Date().toISOString(),
          active: isActive
        };
      });
      writeCache('announcements', normalizedAnnouncements);
      set({ announcements: normalizedAnnouncements, loading: false });
    } else {
      set({ announcements: readCache<Announcement>('announcements'), loading: false });
    }
  },

  createExpenseSheet: async (sheet) => {
    const response = await api.createExpenseSheet(sheet);
    if (!response.success) return false;

    if (response.queued) {
      set(state => {
        const localSheet = response.data || { ...sheet, id: `SHEET-${Date.now()}` };
        const expenseSheets = [...state.expenseSheets, localSheet];
        writeCache(`expenseSheets_${sheet.employeeId}`, expenseSheets);
        return { expenseSheets };
      });
    } else {
      await get().loadExpenseSheets(sheet.employeeId);
    }
    return true;
  },

  updateExpenseSheet: async (sheet) => {
    const response = await api.updateExpenseSheet(sheet);
    if (!response.success) return false;

    set(state => {
      const expenseSheets = state.expenseSheets.map(item => item.id === sheet.id ? sheet : item);
      writeCache(`expenseSheets_${sheet.employeeId}`, expenseSheets);
      return { expenseSheets };
    });
    if (!response.queued) await get().loadExpenseSheets(sheet.employeeId);
    return true;
  },

  sendMessage: async (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
    };
    set(state => {
      const messages = [...state.messages, newMessage];
      writeCache('messages', messages);
      return { messages };
    });

    const response = await api.sendMessage(newMessage);
    if (!response.success) {
      set(state => {
        const messages = state.messages.filter(item => item.id !== newMessage.id);
        writeCache('messages', messages);
        return { messages };
      });
    }
    return response.success;
  },

  markMessagesAsRead: async (messageIds) => {
    const ids = new Set(messageIds);
    set(state => {
      const messages = state.messages.map(message =>
        ids.has(message.id) ? { ...message, read: true } : message
      );
      writeCache('messages', messages);
      return { messages };
    });

    await Promise.all(messageIds.map(messageId => api.markMessageAsRead(messageId)));
  },

  editMessage: async (messageId: string, newText: string) => {
    set(state => {
      const messages = state.messages.map(msg =>
        msg.id === messageId ? { ...msg, text: newText } : msg
      );
      writeCache('messages', messages);
      return { messages };
    });
    const response = await api.editMessage(messageId, newText);
    return response.success;
  },

  deleteMessage: async (messageId: string) => {
    set(state => {
      const messages = state.messages.filter(msg => msg.id !== messageId);
      writeCache('messages', messages);
      return { messages };
    });
    const response = await api.deleteMessage(messageId);
    return response.success;
  },
}));
