import { create } from 'zustand';
import { Employee, AuthState } from '../types';
import { useDataStore } from './dataStore';
import { api } from '../api';

// «Последний вход» раньше никто не записывал — в профиле оставалась старая дата из таблицы.
// Теперь время ставится при входе и при каждом открытии приложения с сохранённым входом
// и отправляется в лист «Сотрудники» (без сети — через очередь отправки).
const withLoginTime = (employee: Employee): Employee => {
  const at = new Date().toISOString();
  void api.recordLastLogin(employee.id, at);
  return { ...employee, lastActivity: at };
};

interface AuthStore extends AuthState {
  login: (employee: Employee) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateShift: (shiftOpen: boolean, serverStatus?: string) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  employee: null,
  token: null,

  login: async (loggedIn: Employee) => {
    // Данные предыдущего сотрудника на этом телефоне не должны попасть к новому
    useDataStore.getState().reset();
    const employee = withLoginTime(loggedIn);
    localStorage.setItem('employee', JSON.stringify(employee));
    localStorage.setItem('token', employee.id);
    
    set({
      isAuthenticated: true,
      employee,
      token: employee.id,
    });
  },

  logout: async () => {
    useDataStore.getState().reset();
    localStorage.removeItem('employee');
    localStorage.removeItem('token');
    
    set({
      isAuthenticated: false,
      employee: null,
      token: null,
    });
  },

  loadSession: async () => {
    try {
      const employeeJson = localStorage.getItem('employee');
      const token = localStorage.getItem('token');
      
      if (employeeJson && token) {
        const employee = withLoginTime(JSON.parse(employeeJson) as Employee);
        localStorage.setItem('employee', JSON.stringify(employee));
        set({
          isAuthenticated: true,
          employee,
          token,
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки сессии:', error);
    }
  },

  updateShift: (shiftOpen: boolean, serverStatus?: string) => {
    set(state => {
      // «Активен» / «Неактивен» определяются сменой: открыта — Активен, закрыта — Неактивен
      // (так их ставит updateEmployeeShiftData в Apps Script). Старый скрипт статус не менял,
      // поэтому в таблице мог остаться «Активен» при закрытой смене — его не показываем.
      // Другие статусы из таблицы (например «Отпуск») показываем как есть.
      const shiftStatus = shiftOpen ? 'Активен' : 'Неактивен';
      const status = serverStatus && serverStatus !== 'Активен' && serverStatus !== 'Неактивен'
        ? serverStatus
        : shiftStatus;
      if (!state.employee || (state.employee.shiftOpen === shiftOpen && state.employee.status === status)) return state;

      const employee: Employee = {
        ...state.employee,
        shiftOpen,
        status,
      };
      localStorage.setItem('employee', JSON.stringify(employee));
      return { employee };
    });
  },
}));
