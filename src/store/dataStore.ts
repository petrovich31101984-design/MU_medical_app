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
    console.log('=== LOADING NOMENCLATURE ===');
    set({ loading: true });
    const response = await api.getNomenclature();
    console.log('Nomenclature response:', response);
    
    if (response.success && response.data) {
      console.log('Nomenclature loaded:', response.data.length, 'items');
      set({ nomenclature: response.data, loading: false });
    } else {
      console.error('Failed to load nomenclature:', response.error);
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
    console.log('=== DATA STORE: Creating expense sheet ===');
    console.log('Sheet data:', sheet);
    
    const response = await api.createExpenseSheet(sheet);
    console.log('API response:', response);
    
    if (response.success) {
      console.log('Expense sheet created successfully');
      const employeeId = sheet.employeeId;
      await get().loadExpenseSheets(employeeId);
      return true;
    } else {
      console.error('Failed to create expense sheet:', response.error);
      return false;
    }
  },

  sendMessage: async (message) => {
    console.log('=== DATA STORE: Sending message ===');
    console.log('Message:', message);
    
    const response = await api.sendMessage(message);
    console.log('API response:', response);
    
    if (response.success) {
      console.log('Message sent successfully, waiting 1 second before reloading...');
      // Даём серверу время обработать запрос
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Reloading messages...');
      await get().loadMessages(message.fromId);
      console.log('Messages reloaded, current count:', get().messages.length);
      return true;
    } else {
      console.error('Failed to send message:', response.error);
      return false;
    }
  },
}));
