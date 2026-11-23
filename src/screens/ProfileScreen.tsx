import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ExpenseSheet } from '../types';
import ScreenHeader from '../components/ScreenHeader';

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

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function ProfileScreen({ onBack, onEditExpenseSheet }: ProfileScreenProps) {
  const { employee } = useAuthStore();
  const { expenseSheets, loadExpenseSheets } = useDataStore();
  const [showRecentSheets, setShowRecentSheets] = useState(false);
  const [viewingSheet, setViewingSheet] = useState<ExpenseSheet | null>(null);

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
  const monthlySheets = expenseSheets
    .filter(sheet => {
      const data = sheet as unknown as Record<string, unknown>;
      const month = String(sheet.month || data['Месяц'] || '').slice(0, 7);
      if (month) return month === currentMonth;

      const date = new Date(String(sheet.date || data['Дата'] || ''));
      return !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    })
    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  const monthlyExpenseCount = monthlySheets.length;
  // Редактировать можно только листы, созданные за последние 24 часа
  const isEditable = (sheet: ExpenseSheet) => {
    const timestamp = new Date(sheet.date).getTime();
    return !Number.isNaN(timestamp) && timestamp >= now.getTime() - EDIT_WINDOW_MS && timestamp <= now.getTime();
  };
  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '—';
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };
  const formatMoney = (value: number) =>
    `${(Number(value) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

  return (
    <div className="min-h-screen bg-slate-50">
      <ScreenHeader icon="👨‍⚕️" title="Профиль" onBack={onBack} />

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
                {new Date(employee.lastActivity).toLocaleString('ru-RU', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
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

      {showRecentSheets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              {viewingSheet ? (
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setViewingSheet(null)}
                    className="text-slate-500 text-xl p-2 -ml-2 hover:bg-slate-100 rounded-lg"
                    aria-label="Назад к списку"
                  >
                    ←
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-800 truncate">{formatPatientName(viewingSheet.patientName)}</h3>
                    <p className="text-sm text-slate-500 mt-1">{formatDateTime(viewingSheet.date)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Листы расхода</h3>
                  <p className="text-sm text-slate-500 mt-1">За текущий месяц · редактирование — 24 часа</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setShowRecentSheets(false); setViewingSheet(null); }}
                className="text-slate-500 text-2xl p-2 hover:bg-slate-100 rounded-lg"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {viewingSheet ? (
                <div className="space-y-3 p-2">
                  <div className="space-y-0 text-sm">
                    {viewingSheet.patientBirthDate && (
                      <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                        <span className="text-slate-500">Дата рождения</span>
                        <span className="text-slate-800 font-medium text-right">
                          {Number.isNaN(new Date(viewingSheet.patientBirthDate).getTime())
                            ? viewingSheet.patientBirthDate
                            : new Date(viewingSheet.patientBirthDate).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    )}
                    {viewingSheet.callCategory && (
                      <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                        <span className="text-slate-500">Категория вызова</span>
                        <span className="text-slate-800 font-medium text-right">{viewingSheet.callCategory}</span>
                      </div>
                    )}
                    {viewingSheet.therapyName && (
                      <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                        <span className="text-slate-500">Терапия</span>
                        <span className="text-slate-800 font-medium text-right">{viewingSheet.therapyName}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800 mb-2">Препараты</p>
                    {(viewingSheet.items || []).length === 0 ? (
                      <p className="text-sm text-slate-500">Нет позиций</p>
                    ) : (
                      <div className="space-y-1">
                        {viewingSheet.items.map((item, idx) => (
                          <div key={`${item.nomenclatureId}-${idx}`} className="flex justify-between gap-3 text-sm py-1.5 border-b border-slate-100">
                            <span className="text-slate-700">{item.name}</span>
                            <span className="text-slate-800 font-medium whitespace-nowrap">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-base font-bold text-slate-800 pt-1">
                    <span>Итого</span>
                    <span>{formatMoney(viewingSheet.totalAmount)}</span>
                  </div>

                  {isEditable(viewingSheet) ? (
                    <button
                      type="button"
                      onClick={() => onEditExpenseSheet(viewingSheet)}
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      ✏️ Редактировать
                    </button>
                  ) : (
                    <p className="text-sm text-slate-500 text-center bg-slate-50 rounded-lg py-3">
                      🔒 Прошло более 24 часов — только просмотр
                    </p>
                  )}
                </div>
              ) : monthlySheets.length === 0 ? (
                <p className="text-center text-slate-500 py-8">В этом месяце листов расхода нет</p>
              ) : (
                <div className="space-y-2">
                  {monthlySheets.map(sheet => {
                    const editable = isEditable(sheet);
                    return (
                      <button
                        type="button"
                        key={sheet.id}
                        onClick={() => setViewingSheet(sheet)}
                        className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-800">{formatPatientName(sheet.patientName)}</span>
                          <span className="block text-sm text-slate-500 mt-1">{formatDateTime(sheet.date)}</span>
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          editable ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {editable ? '✏️ Можно изменить' : '👁 Просмотр'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
