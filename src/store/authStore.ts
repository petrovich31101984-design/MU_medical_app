import { create } from 'zustand';
import { Employee, AuthState } from '../types';

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

  login: async (employee: Employee) => {
    localStorage.setItem('employee', JSON.stringify(employee));
    localStorage.setItem('token', employee.id);
    
    set({
      isAuthenticated: true,
      employee,
      token: employee.id,
    });
  },

  logout: async () => {
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
        const employee = JSON.parse(employeeJson) as Employee;
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
