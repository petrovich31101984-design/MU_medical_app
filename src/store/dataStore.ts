import { create } from 'zustand';
import { Nomenclature, ExpenseSheet, ChatMessage, Announcement } from '../types';
import { api } from '../api';

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
  sendMessage: (message: Omit<ChatMessage, 'id' | 'date'>) => Promise<boolean>;
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
      set({ nomenclature: response.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  loadExpenseSheets: async (employeeId: string) => {
    set({ loading: true });
    const response = await api.getEmployeeExpenseSheets(employeeId);
    if (response.success && response.data) {
      set({ expenseSheets: response.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  loadMessages: async (employeeId: string) => {
    set({ loading: true });
    const response = await api.getEmployeeMessages(employeeId);
    if (response.success && response.data) {
      set({ messages: response.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  loadAnnouncements: async () => {
    set({ loading: true });
    const response = await api.getAnnouncements();
    if (response.success && response.data) {
      set({ announcements: response.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  createExpenseSheet: async (sheet) => {
    const response = await api.createExpenseSheet(sheet);
    if (response.success) {
      const employeeId = sheet.employeeId;
      await get().loadExpenseSheets(employeeId);
      return true;
    }
    return false;
  },

  sendMessage: async (message) => {
    const response = await api.sendMessage(message);
    if (response.success) {
      await get().loadMessages(message.fromId);
      return true;
    }
    return false;
  },
}));
