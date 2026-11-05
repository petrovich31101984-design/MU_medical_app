import React, { useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { Announcement } from '../types';

interface AnnouncementsScreenProps {
  onBack: () => void;
}

export default function AnnouncementsScreen({ onBack }: AnnouncementsScreenProps) {
  const { announcements, loadAnnouncements } = useDataStore();

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // Функция для проверки активности объявления (поддержка разных форматов)
  const isAnnouncementActive = (announcement: any) => {
    return announcement.active === true || 
           announcement.active === 'ДА' || 
           announcement['Активно'] === 'ДА' || 
           announcement['Активно'] === true ||
           announcement['Активно'] === 'true';
  };

  const activeAnnouncements = announcements.filter(isAnnouncementActive);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center">
        <button
          onClick={onBack}
          className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-bold text-slate-800">Объявления</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {activeAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-6xl mb-4">📢</span>
            <p className="text-slate-500 text-base">Нет активных объявлений</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAnnouncements.map((item: Announcement) => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex-1">{item.title}</h3>
                  <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
                    {new Date(item.date).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <p className="text-base text-slate-600 leading-relaxed mb-3">{item.text}</p>
                <p className="text-sm text-slate-400">От: {item.createdBy}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
