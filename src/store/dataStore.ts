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
      // Фильтруем временные сообщения (с ID начинающимся на 'temp_')
      const serverMessages = response.data;
      set(state => {
        // Сохраняем временные сообщения из локального состояния
        const tempMessages = state.messages.filter(msg => msg.id.startsWith('temp_'));
        // Объединяем серверные сообщения с временными
        const allMessages = [...serverMessages, ...tempMessages];
        return { messages: allMessages, loading: false };
      });
    } else {
      set({ loading: false });
    }
  },

  loadAnnouncements: async () => {
    set({ loading: true });
    const response = await api.getAnnouncements();
    console.log('=== LOADING ANNOUNCEMENTS ===');
    console.log('Response:', response);
    
    if (response.success && response.data) {
      // Нормализуем данные объявлений
      const normalizedAnnouncements = response.data.map((ann: any) => {
        console.log('Announcement data:', ann);
        
        // Определяем активность объявления
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
      
      console.log('Normalized announcements:', normalizedAnnouncements);
      set({ announcements: normalizedAnnouncements, loading: false });
    } else {
      console.error('Failed to load announcements:', response.error);
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
    
    // Оптимистичное обновление - добавляем сообщение сразу в локальное состояние
    const newMessage: ChatMessage = {
      ...message,
      id: `temp_${Date.now()}`,
      date: new Date().toISOString(),
    };
    
    console.log('Adding message to local state immediately');
    set(state => ({
      messages: [...state.messages, newMessage]
    }));
    
    const response = await api.sendMessage(message);
    console.log('API response:', response);
    
    if (response.success) {
      console.log('Message sent successfully to server');
      // НЕ перезагружаем сообщения с сервера, чтобы не удалять локальное сообщение
      // Сервер обработает сообщение в фоне
      return true;
    } else {
      console.error('Failed to send message:', response.error);
      return false;
    }
  },

  editMessage: async (messageId: string, newText: string) => {
    console.log('=== DATA STORE: Editing message ===');
    console.log('Message ID:', messageId);
    console.log('New text:', newText);
    
    // Оптимистичное обновление
    set(state => ({
      messages: state.messages.map(msg => 
        msg.id === messageId ? { ...msg, text: newText } : msg
      )
    }));
    
    const response = await api.editMessage(messageId, newText);
    console.log('API response:', response);
    
    return response.success;
  },

  deleteMessage: async (messageId: string) => {
    console.log('=== DATA STORE: Deleting message ===');
    console.log('Message ID:', messageId);
    
    // Оптимистичное удаление
    set(state => ({
      messages: state.messages.filter(msg => msg.id !== messageId)
    }));
    
    const response = await api.deleteMessage(messageId);
    console.log('API response:', response);
    
    return response.success;
  },
}));
