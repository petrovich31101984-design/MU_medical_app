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
    if (!this.scriptUrl) {
      return { success: false, error: 'База данных не подключена' };
    }

    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=authenticateEmployee&personalNumber=${personalNumber}&password=${password}`
      );
      console.log('API Response:', response.data);
      
      // Проверяем, что ответ содержит данные сотрудника
      if (!response.data || typeof response.data !== 'object') {
        return { success: false, error: 'Неверный формат ответа от базы данных' };
      }
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('API Error:', error);
      
      // Определяем тип ошибки
      if (error instanceof Error) {
        if (error.message.includes('Network Error')) {
          return { success: false, error: 'Нет соединения с базой данных' };
        }
        if (error.message.includes('timeout')) {
          return { success: false, error: 'Превышено время ожидания ответа от базы данных' };
        }
      }
      
      return { success: false, error: 'Ошибка подключения к базе данных' };
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
      const response = await this.client.post(this.scriptUrl, {
        action: 'addExpenseSheet',
        data: sheet,
      });
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
      const response = await this.client.post(this.scriptUrl, {
        action: 'addChatMessage',
        data: message,
      });
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
      await this.client.post(this.scriptUrl, {
        action: 'updateEmployeeShift',
        data: { id: employeeId, shiftOpen: true },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка открытия смены' };
    }
  }

  // Закрытие смены
  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    try {
      await this.client.post(this.scriptUrl, {
        action: 'updateEmployeeShift',
        data: { id: employeeId, shiftOpen: false },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка закрытия смены' };
    }
  }
}

export const api = new ApiService();
