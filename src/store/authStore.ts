import { create } from 'zustand';
import { Employee, AuthState } from '../types';

interface AuthStore extends AuthState {
  login: (employee: Employee) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
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
}));
