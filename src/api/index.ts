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

    // При слабой связи запрос может «висеть» минутами — тогда вся очередь стоит.
    // Обрываем через 45 с: запись останется в очереди и уйдёт при следующей попытке.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let result: any;
    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      result = await response.json();
    } finally {
      clearTimeout(timer);
    }
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
      // Параметры экранируются: иначе пароль с символами & # + % ломал вход
      const response = await this.client.get(this.scriptUrl, {
        params: {
          action: 'authenticateEmployee',
          personalNumber: personalNumber.trim(),
          password,
        },
      });

      let data = response.data;
      if (Array.isArray(data)) data = data[0];
      if (data && data.data && typeof data.data === 'object') data = data.data;

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
      console.error('Ошибка авторизации');
      return { success: false, error: 'Ошибка авторизации' };
    }
  }

  async getNomenclature(): Promise<ApiResponse<Nomenclature[]>> {
    try {
      const [response, pricesResponse] = await Promise.all([
        this.client.get(`${this.scriptUrl}?action=getNomenclature`),
        // Цены хранятся на отдельном листе «Цены»; без них лист расхода сохраняется с суммой 0.
        // Ошибка загрузки цен не мешает загрузке номенклатуры.
        this.client.get(`${this.scriptUrl}?action=getPrices`).catch(() => ({ data: [] })),
      ]);
      const rows = Array.isArray(response.data) ? response.data : [];
      const prices: any[] = Array.isArray(pricesResponse.data) ? pricesResponse.data : [];
      // Текущая цена — запись без «Даты окончания» (как в приложении руководителя)
      const currentPrice = (id: unknown) => {
        const row = prices.find(p =>
          String(p['Номенклатура_ID'] ?? '').trim() === String(id ?? '').trim() &&
          (!p['Дата окончания'] || p['Дата окончания'] === '')
        );
        return Number(row?.['Цена за ед. (₽)']) || 0;
      };
      const data = rows.map((row: any) => ({
        ...row,
        currentPrice: Number(row.currentPrice) || currentPrice(row['ID'] ?? row.id),
      }));
      return { success: true, data };
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
        'Итого по препаратам': sheet.totalAmount,
        items: sheet.items,
      },
    });
  }

  async getEmployeeExpenseSheets(employeeId: string): Promise<ApiResponse<ExpenseSheet[]>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=getEmployeeExpenseSheets&employeeId=${encodeURIComponent(employeeId)}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки листов расхода' };
    }
  }

  async getEmployeeMessages(employeeId: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const response = await this.client.get(
        `${this.scriptUrl}?action=getEmployeeMessages&employeeId=${encodeURIComponent(employeeId)}`
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

  async getEmployeeWorkState(employeeId: string): Promise<ApiResponse<{ shiftOpen: boolean; blocked: boolean; status?: string }>> {
    try {
      // Новый запрос: только смена, блокировка и статус этого сотрудника.
      // Раньше телефон каждые 5 секунд скачивал весь лист «Сотрудники» — с паролями,
      // телефонами и email всех сотрудников.
      const own = await this.client.get(this.scriptUrl, {
        params: { action: 'getEmployeeWorkState', employeeId: String(employeeId).trim() },
      });
      if (own.data && typeof own.data.shiftOpen === 'boolean') {
        return {
          success: true,
          data: {
            shiftOpen: own.data.shiftOpen,
            blocked: own.data.blocked === true,
            status: String(own.data.status ?? '').trim() || undefined,
          },
        };
      }
      if (own.data?.success === false && !String(own.data?.error ?? '').startsWith('Неизвестное действие')) {
        return { success: false, error: own.data.error || 'Ошибка обновления статуса сотрудника' };
      }

      // Старый скрипт ещё без getEmployeeWorkState — временно по-старому
      const response = await this.client.get(`${this.scriptUrl}?action=getEmployees`);
      const employees = Array.isArray(response.data) ? response.data : response.data?.data;
      if (!Array.isArray(employees)) {
        return { success: false, error: 'Сервер вернул некорректный список сотрудников' };
      }

      const employee = employees.find(item =>
        String(item['ID'] ?? item.id ?? '').trim() === String(employeeId).trim()
      );
      if (!employee) {
        return { success: false, error: 'Сотрудник не найден' };
      }

      return {
        success: true,
        data: {
          shiftOpen: employee['Смена открыта'] === 'ДА' || employee['Смена открыта'] === true,
          blocked: employee['Заблокирован'] === 'ДА' || employee['Заблокирован'] === true,
          status: String(employee['Статус'] ?? employee.status ?? '').trim() || undefined,
        },
      };
    } catch (error) {
      return { success: false, error: 'Ошибка обновления статуса сотрудника' };
    }
  }

  /** Записать время входа в колонку «Последний вход» листа «Сотрудники» */
  async recordLastLogin(employeeId: string, at: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateEmployee', {
      id: employeeId,
      data: { 'Последний вход': at },
    });
  }

  async openShift(employeeId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateEmployeeShift', {
      id: employeeId,
      shiftOpen: true,
    });
  }

  async closeShift(employeeId: string): Promise<ApiResponse<void>> {
    return this.saveMutation('updateEmployeeShift', {
      id: employeeId,
      shiftOpen: false,
    });
  }
}

export const api = new ApiService();
