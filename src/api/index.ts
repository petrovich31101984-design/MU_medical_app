// API клиент для работы с Google Sheets через Apps Script
import axios, { AxiosInstance } from 'axios';
import { ApiResponse, Employee, ExpenseSheet, ChatMessage, Announcement, Nomenclature } from '../types';

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
      const response = await this.client.get(
        `${this.scriptUrl}?action=authenticateEmployee&personalNumber=${personalNumber}&password=${password}`
      );
      
      let data = response.data;
      
      if (Array.isArray(data)) {
        data = data[0];
      }
      
      if (data && data.data && typeof data.data === 'object') {
        data = data.data;
      }
      
      if (data && typeof data === 'object') {
        if (data.success === false) {
          return { success: false, error: data.error || 'Неверный персональный номер или пароль' };
        }
        
        if (data.error && !data.id) {
          return { success: false, error: data.error };
        }
        
        if (!data.id || !data.fullName || !data.personalNumber) {
          return { success: false, error: 'Неверный персональный номер или пароль' };
        }
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: 'Ошибка авторизации' };
    }
  }

  async getNomenclature(): Promise<ApiResponse<Nomenclature[]>> {
    try {
      console.log('=== GET NOMENCLATURE REQUEST ===');
      console.log('URL:', `${this.scriptUrl}?action=getNomenclature`);
      
      const response = await this.client.get(`${this.scriptUrl}?action=getNomenclature`);
      
      console.log('=== GET NOMENCLATURE RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.log('Data type:', typeof response.data);
      console.log('Is array:', Array.isArray(response.data));
      
      let data = response.data;
      
      // Если Apps Script вернул объект с полем data внутри
      if (data && data.data && Array.isArray(data.data)) {
        console.log('Extracting data from nested object');
        data = data.data;
      }
      
      // Если Apps Script вернул массив
      if (Array.isArray(data)) {
        console.log('Nomenclature count:', data.length);
        if (data.length > 0) {
          console.log('First item structure:', data[0]);
          console.log('First item keys:', Object.keys(data[0]));
        }
        return { success: true, data };
      }
      
      console.warn('Unexpected data format:', data);
      return { success: false, error: 'Неверный формат данных номенклатуры' };
    } catch (error: any) {
      console.error('=== GET NOMENCLATURE ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      return { success: false, error: 'Ошибка загрузки номенклатуры' };
    }
  }

  async createExpenseSheet(sheet: Omit<ExpenseSheet, 'id'>): Promise<ApiResponse<ExpenseSheet>> {
    try {
      console.log('=== CREATE EXPENSE SHEET REQUEST ===');
      console.log('Sheet data:', sheet);
      
      await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addExpenseSheet',
          data: sheet,
        }),
      });
      
      console.log('=== CREATE EXPENSE SHEET - Request sent (no-cors mode) ===');
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
         message,
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

  async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getAnnouncements`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки объявлений' };
    }
  }

  // Открытие смены - используем fetch с no-cors для обхода CORS
  async openShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== OPEN SHIFT REQUEST ===');
      console.log('Employee ID:', employeeId);
      console.log('URL:', this.scriptUrl);
      
      await fetch(this.scriptUrl, {
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
      
      console.log('=== OPEN SHIFT - Request sent (no-cors mode) ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== OPEN SHIFT ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка открытия смены' };
    }
  }

  // Закрытие смены - используем fetch с no-cors для обхода CORS
  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      console.log('=== CLOSE SHIFT REQUEST ===');
      console.log('Employee ID:', employeeId);
      console.log('URL:', this.scriptUrl);
      
      await fetch(this.scriptUrl, {
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
      
      console.log('=== CLOSE SHIFT - Request sent (no-cors mode) ===');
      return { success: true };
    } catch (error: any) {
      console.error('=== CLOSE SHIFT ERROR ===');
      console.error('Error:', error);
      return { success: false, error: 'Ошибка закрытия смены' };
    }
  }
}

export const api = new ApiService();
