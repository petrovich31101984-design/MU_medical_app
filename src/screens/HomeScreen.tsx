import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { api } from '../api';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { employee, logout } = useAuthStore();
  const { loadAnnouncements, announcements } = useDataStore();
  const [shiftStatus, setShiftStatus] = useState(false);
  const [shiftMessage, setShiftMessage] = useState('');

  // Обновляем shiftStatus когда employee загружается
  useEffect(() => {
    if (employee) {
      console.log('HomeScreen employee:', employee);
      console.log('Full name:', employee.fullName);
      console.log('Employee keys:', Object.keys(employee));
      setShiftStatus(employee.shiftOpen || false);
      loadAnnouncements();
    }
  }, [employee]);

  const handleToggleShift = async () => {
    if (!employee) return;

    try {
      if (shiftStatus) {
        const result = await api.closeShift(employee.id);
        if (result.success) {
          setShiftStatus(false);
          setShiftMessage('Смена закрыта');
        } else {
          setShiftMessage('Не удалось закрыть смену');
        }
      } else {
        const result = await api.openShift(employee.id);
        if (result.success) {
          setShiftStatus(true);
          setShiftMessage('Смена открыта');
        } else {
          setShiftMessage('Не удалось открыть смену');
        }
      }
      setTimeout(() => setShiftMessage(''), 3000);
    } catch (error) {
      setShiftMessage('Не удалось изменить статус смены');
      setTimeout(() => setShiftMessage(''), 3000);
    }
  };

  const unreadMessages = 0;
  const activeAnnouncements = announcements.filter(a => a.active).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white p-5 flex justify-between items-center border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500">
            Здравствуйте, {employee?.fullName ? employee.fullName.split(' ').slice(1, 3).join(' ') : 'Сотрудник'}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-red-600 text-sm p-2 hover:bg-red-50 rounded-lg transition-colors"
        >
          Выйти
        </button>
      </div>

      {/* Shift Card */}
      <div className="bg-white m-5 p-5 rounded-xl border border-slate-200">
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">Статус смены</p>
          <p className={`text-lg font-bold ${shiftStatus ? 'text-green-600' : 'text-slate-500'}`}>
            {shiftStatus ? '🟢 Смена открыта' : '⚪ Смена закрыта'}
          </p>
        </div>
        {shiftMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
            <p className="text-sm text-blue-600">{shiftMessage}</p>
          </div>
        )}
        <button
          className={`w-full py-4 rounded-lg font-bold text-white transition-colors ${
            shiftStatus
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          onClick={handleToggleShift}
        >
          {shiftStatus ? 'Закрыть смену' : 'Открыть смену'}
        </button>
      </div>

      {/* Menu */}
      <div className="p-5 space-y-3">
        <button
          className="bg-white w-full p-4 rounded-xl border border-slate-200 flex items-center hover:bg-slate-50 transition-colors"
          onClick={() => onNavigate('ExpenseSheet')}
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 text-2xl">
            📝
          </div>
          <div className="text-left flex-1">
            <p className="text-base font-bold text-slate-800">Лист расхода</p>
            <p className="text-sm text-slate-500 mt-1">Создать новый лист расхода</p>
          </div>
        </button>

        <button
          className="bg-white w-full p-4 rounded-xl border border-slate-200 flex items-center hover:bg-slate-50 transition-colors"
          onClick={() => onNavigate('Messages')}
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 text-2xl">
            💬
          </div>
          <div className="text-left flex-1">
            <p className="text-base font-bold text-slate-800">Сообщения</p>
            <p className="text-sm text-slate-500 mt-1">
              {unreadMessages > 0
                ? `${unreadMessages} непрочитанных`
                : 'Нет новых сообщений'}
            </p>
          </div>
          {unreadMessages > 0 && (
            <div className="bg-red-600 rounded-full px-2 py-1 min-w-[24px] flex items-center justify-center">
              <span className="text-white text-xs font-bold">{unreadMessages}</span>
            </div>
          )}
        </button>

        <button
          className="bg-white w-full p-4 rounded-xl border border-slate-200 flex items-center hover:bg-slate-50 transition-colors"
          onClick={() => onNavigate('Announcements')}
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 text-2xl">
            📢
          </div>
          <div className="text-left flex-1">
            <p className="text-base font-bold text-slate-800">Объявления</p>
            <p className="text-sm text-slate-500 mt-1">
              {activeAnnouncements > 0
                ? `${activeAnnouncements} активных`
                : 'Нет объявлений'}
            </p>
          </div>
          {activeAnnouncements > 0 && (
            <div className="bg-red-600 rounded-full px-2 py-1 min-w-[24px] flex items-center justify-center">
              <span className="text-white text-xs font-bold">{activeAnnouncements}</span>
            </div>
          )}
        </button>

        <button
          className="bg-white w-full p-4 rounded-xl border border-slate-200 flex items-center hover:bg-slate-50 transition-colors"
          onClick={() => onNavigate('Profile')}
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 text-2xl">
            👤
          </div>
          <div className="text-left flex-1">
            <p className="text-base font-bold text-slate-800">Профиль</p>
            <p className="text-sm text-slate-500 mt-1">Личная информация</p>
          </div>
        </button>
      </div>
    </div>
  );
}
