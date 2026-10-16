import React from 'react';
import { useAuthStore } from '../store/authStore';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { employee, logout } = useAuthStore();

  if (!employee) return null;

  const initials = (employee.fullName || '')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center">
        <button
          onClick={onBack}
          className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-bold text-slate-800">Профиль</h1>
      </div>

      <div className="bg-white p-6 flex flex-col items-center border-b border-slate-200">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-4">
          <span className="text-3xl font-bold text-white">{initials}</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{employee.fullName}</h2>
        <p className="text-base text-slate-500">{employee.position}</p>
      </div>

      <div className="bg-white m-5 p-5 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Личная информация</h3>
        
        <div className="space-y-0">
          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-sm text-slate-500">Персональный номер</span>
            <span className="text-sm text-slate-800 font-medium">{employee.personalNumber}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-sm text-slate-500">Телефон</span>
            <span className="text-sm text-slate-800 font-medium">
              {employee.phone || 'Не указан'}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-sm text-slate-500">Статус</span>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              employee.status === 'Активен'
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {employee.status}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-sm text-slate-500">Дата регистрации</span>
            <span className="text-sm text-slate-800 font-medium">
              {new Date(employee.hireDate).toLocaleDateString('ru-RU')}
            </span>
          </div>

          {employee.lastActivity && (
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-slate-500">Последний вход</span>
              <span className="text-sm text-slate-800 font-medium">
                {new Date(employee.lastActivity).toLocaleString('ru-RU')}
              </span>
            </div>
          )}
        </div>
      </div>

      {employee.note && (
        <div className="bg-white m-5 p-5 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Примечание</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{employee.note}</p>
        </div>
      )}

      <div className="p-5">
        <button
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors"
          onClick={logout}
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
