import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ExpenseSheet } from '../types';

interface ProfileScreenProps {
  onBack: () => void;
  onEditExpenseSheet: (sheet: ExpenseSheet) => void;
}

const formatPatientName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Пациент не указан';
  const initials = parts.slice(1, 3).map(part => `${part[0].toUpperCase()}.`).join(' ');
  return [parts[0], initials].filter(Boolean).join(' ');
};

export default function ProfileScreen({ onBack, onEditExpenseSheet }: ProfileScreenProps) {
  const { employee, logout } = useAuthStore();
  const { expenseSheets, loadExpenseSheets } = useDataStore();
  const [showRecentSheets, setShowRecentSheets] = useState(false);

  useEffect(() => {
    if (employee) void loadExpenseSheets(employee.id);
  }, [employee?.id]);

  if (!employee) return null;

  const initials = (employee.fullName || '')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyExpenseCount = expenseSheets.filter(sheet => {
    const data = sheet as unknown as Record<string, unknown>;
    const month = String(sheet.month || data['Месяц'] || '').slice(0, 7);
    if (month) return month === currentMonth;

    const date = new Date(String(sheet.date || data['Дата'] || ''));
    return !Number.isNaN(date.getTime()) &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth();
  }).length;
  const recentSheets = expenseSheets
    .filter(sheet => {
      const timestamp = new Date(sheet.date).getTime();
      return !Number.isNaN(timestamp) && timestamp >= now.getTime() - 24 * 60 * 60 * 1000 && timestamp <= now.getTime();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

          <button
            type="button"
            onClick={() => setShowRecentSheets(true)}
            className="w-[calc(100%+2.5rem)] -mx-5 px-5 flex justify-between items-center py-3 border-b border-slate-100 gap-4 text-left hover:bg-blue-50 transition-colors"
          >
            <span className="text-sm text-slate-500">Листов расхода за текущий месяц</span>
            <span className="text-lg text-blue-600 font-bold">
              {monthlyExpenseCount}
            </span>
          </button>

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

      {showRecentSheets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Листы расхода</h3>
                <p className="text-sm text-slate-500 mt-1">За последние 24 часа</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecentSheets(false)}
                className="text-slate-500 text-2xl p-2 hover:bg-slate-100 rounded-lg"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {recentSheets.length === 0 ? (
                <p className="text-center text-slate-500 py-8">За последние сутки листов расхода нет</p>
              ) : (
                <div className="space-y-2">
                  {recentSheets.map(sheet => (
                    <button
                      type="button"
                      key={sheet.id}
                      onClick={() => onEditExpenseSheet(sheet)}
                      className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <span className="block font-bold text-slate-800">{formatPatientName(sheet.patientName)}</span>
                      <span className="block text-sm text-slate-500 mt-1">
                        {new Date(sheet.date).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
