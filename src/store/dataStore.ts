import { create } from 'zustand';
import { Nomenclature, ExpenseSheet, ChatMessage, Announcement } from '../types';
import { api } from '../api';
import { getQueuedItems } from './syncStore';

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

// Декорирование: руководитель включает гирлянду в своём приложении, настройка хранится служебной
// записью на листе «Объявления» (ID DECOR_RECORD_ID, «Текст» — JSON {"garland":true,...}, «Активно» = НЕТ).
// Сотруднику показываем только гирлянду (снег — лишь у руководителя и кладовщика).
const DECOR_RECORD_ID = 'smu-decor';
const isDecorRecord = (ann: any) => String(ann?.id ?? ann?.['ID'] ?? '').trim() === DECOR_RECORD_ID;
// Если служебных записей несколько (могли появиться дубли) — действует самая свежая по «Дате»
const recordTime = (ann: any) => {
  const t = new Date(ann?.date ?? ann?.['Дата'] ?? '').getTime();
  return Number.isNaN(t) ? 0 : t;
};
const readDecorGarland = (records: any[]): boolean => {
  const record = records.filter(isDecorRecord).sort((a, b) => recordTime(b) - recordTime(a))[0];
  try {
    return JSON.parse(record?.text ?? record?.['Текст'] ?? '{}').garland === true;
  } catch {
    return false;
  }
};
const DECOR_CACHE_KEY = 'cache_decor_garland';
const readCachedGarland = () => {
  try { return localStorage.getItem(DECOR_CACHE_KEY) === '1'; } catch { return false; }
};

// Кэш сообщений — отдельно для каждого сотрудника: на общем телефоне
// следующий сотрудник не должен увидеть переписку предыдущего.
const messagesCacheKey = (employeeId: string) => `messages_${employeeId}`;
// Старый общий кэш (без сотрудника) содержит чужую переписку — удаляем его
try { localStorage.removeItem('cache_messages'); } catch { /* хранилище недоступно */ }

// Сообщения, отправленные с этого устройства, которых ещё нет в ответе сервера.
// Без этого автообновление (каждые 5 с) затирало только что отправленное сообщение,
// пока Apps Script не запишет его в таблицу, и оно появлялось с задержкой.
const pendingMessageIds = new Set<string>();

// Сообщения, ожидающие отправки в офлайн-очереди (переживают перезагрузку приложения)
const queuedMessageIds = (): Set<string> => {
  try {
    const queue = JSON.parse(localStorage.getItem('offlineSyncQueue') || '[]');
    return new Set(
      (Array.isArray(queue) ? queue : [])
        .filter((item: any) => item?.action === 'addChatMessage' && item?.data?.id)
        .map((item: any) => String(item.data.id))
    );
  } catch {
    return new Set();
  }
};

// Листы расхода из офлайн-очереди, которые ещё не дошли до таблицы.
// Без этого обновление списка с сервера «теряло» их с экрана (и из кэша) до отправки,
// а неотправленная правка затиралась старой версией листа с сервера.
const withQueuedSheets = (serverSheets: ExpenseSheet[], employeeId: string): ExpenseSheet[] => {
  let sheets = [...serverSheets];
  for (const item of getQueuedItems()) {
    const data = item.data;
    if (!data) continue;
    if (item.action === 'addExpenseSheet' && String(data.employeeId) === String(employeeId)) {
      if (!sheets.some(s => String(s.id) === String(data.id))) sheets.push(data as ExpenseSheet);
    } else if (item.action === 'updateExpenseSheet' && data.id && data.data) {
      const u = data.data;
      sheets = sheets.map(s => String(s.id) !== String(data.id) ? s : {
        ...s,
        patientName: u['Пациент'] ?? s.patientName,
        patientBirthDate: u['Дата рождения пациента'] ?? s.patientBirthDate,
        date: u['Дата'] ?? s.date,
        month: u['Месяц'] ?? s.month,
        callCategory: u['Категория выезда'] ?? s.callCategory,
        therapyName: u['Название терапии'] ?? s.therapyName,
        therapyCost: u['Стоимость терапии'] ?? s.therapyCost,
        totalAmount: u['Итого по препаратам'] ?? s.totalAmount,
        items: Array.isArray(u.items) ? u.items : s.items,
      });
    }
  }
  return sheets;
};

/** ID листов расхода, которые созданы или изменены на телефоне и ещё не отправлены */
export const getUnsentSheetIds = (): Set<string> => new Set(
  getQueuedItems()
    .filter(item => item.action === 'addExpenseSheet' || item.action === 'updateExpenseSheet')
    .map(item => String(item.data?.id ?? ''))
    .filter(Boolean)
);

interface DataStore {
  nomenclature: Nomenclature[];
  expenseSheets: ExpenseSheet[];
  messages: ChatMessage[];
  announcements: Announcement[];
  /** Новогодняя гирлянда под объявлением — включает руководитель */
  garland: boolean;
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
  /** Очистить данные сотрудника в памяти (при выходе и входе) */
  reset: () => void;
}

// Сотрудник, чьи сообщения сейчас в памяти (для ключа кэша при отправке/правке)
let currentMessagesOwner = '';
const writeMessagesCache = (messages: ChatMessage[]) => {
  if (currentMessagesOwner) writeCache(messagesCacheKey(currentMessagesOwner), messages);
};

export const useDataStore = create<DataStore>((set, get) => ({
  nomenclature: [],
  expenseSheets: [],
  messages: [],
  announcements: [],
  garland: readCachedGarland(),
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
    if (response.success && Array.isArray(response.data)) {
      const expenseSheets = withQueuedSheets(response.data, employeeId);
      writeCache(`expenseSheets_${employeeId}`, expenseSheets);
      set({ expenseSheets, loading: false });
    } else {
      set({ expenseSheets: withQueuedSheets(readCache<ExpenseSheet>(`expenseSheets_${employeeId}`), employeeId), loading: false });
    }
  },

  loadMessages: async (employeeId: string) => {
    set({ loading: true });
    currentMessagesOwner = employeeId;
    const response = await api.getEmployeeMessages(employeeId);
    // Пока шла загрузка, мог смениться сотрудник — чужой ответ не применяем
    if (currentMessagesOwner !== employeeId) return;
    if (response.success && response.data) {
      const serverMessages = response.data;
      set(state => {
        const locallyReadIds = new Set(
          state.messages.filter(message => message.read).map(message => message.id)
        );
        const mergedServerMessages = serverMessages.map(message =>
          locallyReadIds.has(message.id) ? { ...message, read: true } : message
        );
        const serverIds = new Set(serverMessages.map(message => String(message.id)));
        // Сервер уже вернул сообщение — больше не нужно держать его локально
        serverIds.forEach(id => pendingMessageIds.delete(id));
        const queuedIds = queuedMessageIds();
        const localOnlyMessages = state.messages.filter(msg =>
          !serverIds.has(String(msg.id)) &&
          (msg.id.startsWith('temp_') || pendingMessageIds.has(msg.id) || queuedIds.has(msg.id))
        );
        const allMessages = [...mergedServerMessages, ...localOnlyMessages];
        writeCache(messagesCacheKey(employeeId), allMessages);
        return { messages: allMessages, loading: false };
      });
    } else {
      set({ messages: readCache<ChatMessage>(messagesCacheKey(employeeId)), loading: false });
    }
  },

  loadAnnouncements: async () => {
    set({ loading: true });
    const response = await api.getAnnouncements();
    if (response.success && response.data) {
      // Служебная запись декора — не объявление: читаем из неё гирлянду и убираем из списка
      const garland = readDecorGarland(response.data);
      try { localStorage.setItem(DECOR_CACHE_KEY, garland ? '1' : '0'); } catch { /* хранилище недоступно */ }
      set({ garland });
      const normalizedAnnouncements = response.data.filter((ann: any) => !isDecorRecord(ann)).map((ann: any) => {
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
      set({ announcements: readCache<Announcement>('announcements').filter(ann => !isDecorRecord(ann)), loading: false });
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
    pendingMessageIds.add(newMessage.id);
    set(state => {
      const messages = [...state.messages, newMessage];
      writeMessagesCache(messages);
      return { messages };
    });

    const response = await api.sendMessage(newMessage);
    if (!response.success) {
      pendingMessageIds.delete(newMessage.id);
      set(state => {
        const messages = state.messages.filter(item => item.id !== newMessage.id);
        writeMessagesCache(messages);
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
      writeMessagesCache(messages);
      return { messages };
    });

    await Promise.all(messageIds.map(messageId => api.markMessageAsRead(messageId)));
  },

  editMessage: async (messageId: string, newText: string) => {
    set(state => {
      const messages = state.messages.map(msg =>
        msg.id === messageId ? { ...msg, text: newText } : msg
      );
      writeMessagesCache(messages);
      return { messages };
    });
    const response = await api.editMessage(messageId, newText);
    return response.success;
  },

  deleteMessage: async (messageId: string) => {
    set(state => {
      const messages = state.messages.filter(msg => msg.id !== messageId);
      writeMessagesCache(messages);
      return { messages };
    });
    const response = await api.deleteMessage(messageId);
    return response.success;
  },

  reset: () => {
    currentMessagesOwner = '';
    pendingMessageIds.clear();
    set({ expenseSheets: [], messages: [], loading: false });
  },
}));
