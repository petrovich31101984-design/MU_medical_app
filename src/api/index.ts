// API клиент для работы с Google Sheets через Apps Script
import axios, { AxiosInstance } from 'axios';
import { ApiResponse, Employee, ExpenseSheet, ChatMessage, Announcement, Nomenclature, InitialStockItem } from '../types';

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
  }

  async initialize() {
    const url = localStorage.getItem(CONFIG_KEY);
    if (url) {
      this.scriptUrl = url;
    }
  }

  async saveConfig(url: string) {
    localStorage.setItem(CONFIG_KEY, url);
    this.scriptUrl = url;
  }

  getConfigUrl(): string {
    return this.scriptUrl;
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
      if (initialized) return { success: true, data: true };

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
      return migration.success
        ? { success: true, data: true }
        : { success: false, error: migration.error };
    } catch (error) {
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
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'addInitialStock',
          data: {
            'ID': `INITIAL-${employeeId}`,
            'Сотрудник_ID': employeeId,
            'ФИО сотрудника': employeeName,
            'Дата': now.toISOString(),
            'Период': month,
            'Позиции (JSON)': JSON.stringify(items),
            'Дата внесения': now.toISOString(),
            'Комментарий': 'Первичный ввод остатков сотрудником',
          },
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Ошибка сервера: ${response.status}` };
      }

      const result = await response.json();
      if (!result.success || result.error) {
        return { success: false, error: result.error || 'Сервер не подтвердил сохранение' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка сохранения начальных остатков' };
    }
  }

  async createExpenseSheet(sheet: Omit<ExpenseSheet, 'id'>): Promise<ApiResponse<ExpenseSheet>> {
    try {
      console.log('=== CREATE EXPENSE SHEET REQUEST ===');
      console.log('Sheet data:', sheet);
      
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'addExpenseSheet',
          data: sheet,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Ошибка сервера: ${response.status}` };
      }

      const result = await response.json();
      if (!result.success || result.error) {
        return { success: false, error: result.error || 'Сервер не подтвердил сохранение' };
      }

      console.log('=== CREATE EXPENSE SHEET - Saved successfully ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== CREATE EXPENSE SHEET ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка создания листа расхода' };
    }
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

  async sendMessage(message: Omit<ChatMessage, 'id' | 'date'>): Promise<ApiResponse<ChatMessage>> {
    try {
      console.log('=== SEND MESSAGE REQUEST ===');
      console.log('Full message object:', JSON.stringify(message, null, 2));
      console.log('toId:', message.toId);
      console.log('toName:', message.toName);
      console.log('fromId:', message.fromId);
      console.log('fromName:', message.fromName);
      
      const requestBody = {
        action: 'addChatMessage',
        data: message,
      };
      
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('=== SEND MESSAGE - Request sent (no-cors mode) ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== SEND MESSAGE ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка отправки сообщения' };
    }
  }

  async editMessage(messageId: string, newText: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== EDIT MESSAGE REQUEST ===');
      console.log('Message ID:', messageId);
      console.log('New text:', newText);
      
      const requestBody = {
        action: 'editChatMessage',
        data: { id: messageId, text: newText },
      };
      
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('=== EDIT MESSAGE - Request sent (no-cors mode) ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== EDIT MESSAGE ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка редактирования сообщения' };
    }
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== DELETE MESSAGE REQUEST ===');
      console.log('Message ID:', messageId);
      
      const requestBody = {
        action: 'deleteChatMessage',
        data: { id: messageId },
      };
      
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('=== DELETE MESSAGE - Request sent (no-cors mode) ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== DELETE MESSAGE ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка удаления сообщения' };
    }
  }

  async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getAnnouncements`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки объявлений' };
    }
  }

  async openShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== OPEN SHIFT REQUEST ===');
      console.log('Employee ID:', employeeId);
      
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateEmployeeShift',
          data: { id: employeeId, shiftOpen: true, status: 'Активен' },
        }),
      });
      
      console.log('=== OPEN SHIFT RESPONSE ===');
      console.log('Type:', response.type);
      
      return { success: true };
    } catch (error: any) {
      console.error('=== OPEN SHIFT ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка открытия смены' };
    }
  }

  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== CLOSE SHIFT REQUEST ===');
      console.log('Employee ID:', employeeId);
      
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateEmployeeShift',
          data: { id: employeeId, shiftOpen: false, status: 'Неактивен' },
        }),
      });
      
      console.log('=== CLOSE SHIFT RESPONSE ===');
      console.log('Type:', response.type);
      
      return { success: true };
    } catch (error: any) {
      console.error('=== CLOSE SHIFT ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка закрытия смены' };
    }
  }
}

export const api = new ApiService();
