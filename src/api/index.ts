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

  // Инициализация URL из localStorage
  async initialize() {
    const url = localStorage.getItem(CONFIG_KEY);
    if (url) {
      this.scriptUrl = url;
    }
  }

  // Сохранение URL
  async saveConfig(url: string) {
    localStorage.setItem(CONFIG_KEY, url);
    this.scriptUrl = url;
  }

  // Получить URL
  getConfigUrl(): string {
    return this.scriptUrl;
  }

  // Проверка подключения
  async testConnection(): Promise<ApiResponse<{ title: string; sheets: string[] }>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=test`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка подключения' };
    }
  }

  // Авторизация сотрудника
  async authenticateEmployee(personalNumber: string, password: string): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=authenticateEmployee&personalNumber=${personalNumber}&password=${password}`
      );
      
      let data = response.data;
      
      // Если Apps Script вернул массив, берём первый элемент
      if (Array.isArray(data)) {
        data = data[0];
      }
      
      // Если Apps Script вернул объект с полем data внутри
      if (data && data.data && typeof data.data === 'object') {
        data = data.data;
      }
      
      // Проверяем, что Apps Script не вернул ошибку
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

  // Получение номенклатуры
  async getNomenclature(): Promise<ApiResponse<Nomenclature[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getNomenclature`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки номенклатуры' };
    }
  }

  // Создание листа расхода
  async createExpenseSheet(sheet: Omit<ExpenseSheet, 'id'>): Promise<ApiResponse<ExpenseSheet>> {
    try {
      const sheetJson = encodeURIComponent(JSON.stringify(sheet));
      const response = await this.client.get(
        `${this.scriptUrl}?action=addExpenseSheet&data=${sheetJson}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка создания листа расхода' };
    }
  }

  // Получение листов расхода сотрудника
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

  // Получение сообщений сотрудника
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

  // Отправка сообщения
  async sendMessage(message: Omit<ChatMessage, 'id' | 'date'>): Promise<ApiResponse<ChatMessage>> {
    try {
      const messageJson = encodeURIComponent(JSON.stringify(message));
      const response = await this.client.get(
        `${this.scriptUrl}?action=addChatMessage&data=${messageJson}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка отправки сообщения' };
    }
  }

  // Получение объявлений
  async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
    try {
      const response = await this.client.get(`${this.scriptUrl}?action=getAnnouncements`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки объявлений' };
    }
  }

  // Открытие смены
  async openShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=updateEmployeeShift&id=${employeeId}&shiftStatus=Активен`
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка открытия смены' };
    }
  }

  // Закрытие смены
  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=updateEmployeeShift&id=${employeeId}&shiftStatus=Закрыта`
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка закрытия смены' };
    }
  }
}

export const api = new ApiService();
