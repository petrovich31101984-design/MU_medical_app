// API клиент для работы с Google Sheets через Apps Script
import axios, { AxiosInstance } from 'axios';
import { ApiResponse, Employee, ExpenseSheet, ChatMessage, Announcement, Nomenclature, InitialStockItem } from '../types';
import { useSyncStore } from '../store/syncStore';

const CONFIG_KEY = 'appsScriptConfig';

class ApiService {
  private client: AxiosInstance;
  private scriptUrl: string = '';

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    useSyncStore.getState().setSender((action, data) => this.postToServer(action, data));
    useSyncStore.getState().initialize();
  }

  async initialize() {
    const url = localStorage.getItem(CONFIG_KEY);
    if (url) {
      this.scriptUrl = url;
      await useSyncStore.getState().flush();
    }
  }

  async saveConfig(url: string) {
    localStorage.setItem(CONFIG_KEY, url);
    this.scriptUrl = url;
    await useSyncStore.getState().flush();
  }

  getConfigUrl(): string {
    return this.scriptUrl;
  }

  private async postToServer(action: string, data: unknown): Promise<void> {
    if (!this.scriptUrl) throw new Error('Не настроен адрес базы данных');

    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data }),
    });
    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

    const result = await response.json();
    if (!result.success || result.error) {
      throw new Error(result.error || 'Сервер не подтвердил сохранение');
    }
  }

  private async saveMutation<T>(action: string, data: unknown): Promise<ApiResponse<T>> {
    try {
      const { queued } = await useSyncStore.getState().enqueue(action, data);
      return { success: true, queued };
    } catch {
      return { success: false, error: 'Не удалось сохранить данные на устройстве' };
    }
  }

  async testConnection(): Promise<ApiResponse<{ title: string; sheets: string[] }>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=test`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка подключения' };
    }
  }

  async authenticateEmployee(personalNumber: string, password: string): Promise<ApiResponse<Employee>> {
    try {
      console.log('=== AUTHENTICATE EMPLOYEE ===');
      console.log('Personal Number:', personalNumber);
      console.log('Script URL:', this.scriptUrl);
      
      const response = await this.client.get(
        `${this.scriptUrl}?action=authenticateEmployee&personalNumber=${personalNumber}&password=${password}`
      );
      
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      
      let data = response.data;
      
      if (Array.isArray(data)) {
        console.log('Data is array, taking first element');
        data = data[0];
      }
      
      if (data && data.data && typeof data.data === 'object') {
        console.log('Data has nested data field');
        data = data.data;
      }
      
      console.log('Final data:', data);
      
      if (data && typeof data === 'object') {
        if (data.success === false) {
          console.log('Server returned success: false');
          return { success: false, error: data.error || 'Неверный персональный номер или пароль' };
        }
        
        if (data.error && !data.id) {
          console.log('Server returned error:', data.error);
          return { success: false, error: data.error };
        }
        
        if (!data.id) {
          console.log('Missing required field: id');
          return { success: false, error: 'Неверный персональный номер или пароль' };
        }
        
        if (!data.fullName) {
          console.log('Missing required field: fullName');
          return { success: false, error: 'Неверный персональный номер или пароль' };
        }
        
        if (!data.personalNumber) {
          console.log('Missing required field: personalNumber');
          return { success: false, error: 'Неверный персональный номер или пароль' };
        }
      }
      
      console.log('Authentication successful');
      return { success: true, data };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Ошибка авторизации' };
    }
  }

  async getNomenclature(): Promise<ApiResponse<Nomenclature[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getNomenclature`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки номенклатуры' };
    }
  }

  async hasInitialStock(employeeId: string): Promise<ApiResponse<boolean>> {
    try {
      const searchId = String(employeeId).trim();
      const response = await this.client.get(
        `${this.scriptUrl}?action=getInitialStock&employeeId=${encodeURIComponent(searchId)}`
      );
      const stockRows = Array.isArray(response.data) ? response.data : response.data?.data;
      if (!Array.isArray(stockRows)) {
        return { success: false, error: response.data?.error || 'Сервер вернул некорректный список начальных остатков' };
      }

      const initialized = stockRows.some((row: any) =>
        String(row['Сотрудник_ID'] ?? row.employeeId ?? '').trim() === searchId &&
        String(row['Номенклатура_ID'] ?? row.nomenclatureId ?? '').trim() !== ''
      );
      if (initialized) {
        localStorage.setItem(`initialStockSaved_${searchId}`, 'true');
        return { success: true, data: true };
      }

      const legacyResponse = await this.client.get(`${this.scriptUrl}?action=getArrivals`);
      const arrivals = Array.isArray(legacyResponse.data) ? legacyResponse.data : legacyResponse.data?.data;
      if (!Array.isArray(arrivals)) {
        return { success: false, error: legacyResponse.data?.error || 'Сервер вернул некорректный список приходов' };
      }

      const hasLegacyStock = arrivals.some((arrival: any) =>
        String(arrival['Сотрудник_ID'] ?? arrival.employeeId ?? '').trim() === searchId &&
        String(arrival['Тип'] ?? arrival.type ?? '').trim().toLowerCase() === 'начальные остатки'
      );
      if (!hasLegacyStock) return { success: true, data: false };

      const migration = await this.migrateInitialStock(searchId);
      if (migration.success) {
        localStorage.setItem(`initialStockSaved_${searchId}`, 'true');
        return { success: true, data: true };
      }
      return { success: false, error: migration.error };
    } catch (error) {
      const savedLocally = localStorage.getItem(`initialStockSaved_${employeeId}`) === 'true';
      if (savedLocally || !navigator.onLine) return { success: true, data: true };
      return { success: false, error: 'Не удалось проверить начальные остатки' };
    }
  }

  private async migrateInitialStock(employeeId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'migrateInitialStock',
          data: { employeeId },
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Ошибка сервера: ${response.status}` };
      }

      const result = await response.json();
      if (!result.success || result.error) {
        return { success: false, error: result.error || 'Не удалось перенести начальные остатки' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка переноса начальных остатков' };
    }
  }

  async saveInitialStock(
    employeeId: string,
    employeeName: string,
    items: InitialStockItem[]
  ): Promise<ApiResponse<void>> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const data = {
      'ID': `INITIAL-${employeeId}`,
      'Сотрудник_ID': employeeId,
      'ФИО сотрудника': employeeName,
      'Дата': now.toISOString(),
      'Период': month,
      'Позиции (JSON)': JSON.stringify(items),
      'Дата внесения': now.toISOString(),
      'Комментарий': 'Первичный ввод остатков сотрудником',
    };

    try {
      localStorage.setItem(`initialStockSaved_${employeeId}`, 'true');
      return await this.saveMutation('addInitialStock', data);
    } catch {
      return { success: false, error: 'Не удалось сохранить начальные остатки на устройстве' };
    }
  }

  async createExpenseSheet(sheet: Omit<ExpenseSheet, 'id'>): Promise<ApiResponse<ExpenseSheet>> {
    const createdSheet: ExpenseSheet = {
      ...sheet,
      id: `SHEET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    const response = await this.saveMutation<ExpenseSheet>('addExpenseSheet', createdSheet);
    return { ...response, data: createdSheet };
  }

  async updateExpenseSheet(sheet: ExpenseSheet): Promise<ApiResponse<void>> {
    return this.saveMutation('updateExpenseSheet', {
      id: sheet.id,
      data: {
        'Пациент': sheet.patientName,
        'Дата рождения пациента': sheet.patientBirthDate,
        'Дата': sheet.date,
        'Месяц': sheet.month,
        'Категория выезда': sheet.callCategory,
        'Название терапии': sheet.therapyName,
        'Стоимость терапии': sheet.therapyCost,
        'Итого по препаратам': sheet.totalAmount,
        items: sheet.items,
      },
    });
  }

  async getEmployeeExpenseSheets(employeeId: string): Promise<ApiResponse<ExpenseSheet[]>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=getEmployeeExpenseSheets&employeeId=${employeeId}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки листов расхода' };
    }
  }

  async getEmployeeMessages(employeeId: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=getEmployeeMessages&employeeId=${employeeId}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки сообщений' };
    }
  }

  async sendMessage(message: ChatMessage): Promise<ApiResponse<ChatMessage>> {
    return this.saveMutation('addChatMessage', message);
  }

  async markMessageAsRead(messageId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateChatMessage', { id: messageId, 'Прочитано': 'ДА' });
  }

  async editMessage(messageId: string, newText: string): Promise<ApiResponse<void>> {
    return this.saveMutation('editChatMessage', { id: messageId, text: newText });
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('deleteChatMessage', { id: messageId });
  }

  async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getAnnouncements`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки объявлений' };
    }
  }

  async createReturn(data: {
    employeeId: string;
    employeeName: string;
    nomenclatureId: string;
    nomenclatureName: string;
    unit: string;
    quantity: number;
    reason: string;
  }): Promise<ApiResponse<void>> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.saveMutation('addReturn', {
      'ID': `RETURN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      'Сотрудник_ID': data.employeeId,
      'ФИО сотрудника': data.employeeName,
      'Дата создания': now.toISOString(),
      'Месяц': month,
      'Номенклатура_ID': data.nomenclatureId,
      'Название': data.nomenclatureName,
      'Ед. измерения': data.unit,
      'Ед. изм.': data.unit,
      'Количество': data.quantity,
      'Статус': 'Ожидает подтверждения',
      'Причина': data.reason,
    });
  }

  async openShift(employeeId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateEmployeeShift', {
      id: employeeId,
      shiftOpen: true,
      status: 'Активен',
    });
  }

  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateEmployeeShift', {
      id: employeeId,
      shiftOpen: false,
      status: 'Неактивен',
    });
  }
}

export const api = new ApiService();
