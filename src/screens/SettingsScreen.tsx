import React, { useState } from 'react';
import { api } from '../api';
import ScreenHeader from '../components/ScreenHeader';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [scriptUrl, setScriptUrl] = useState(api.getConfigUrl());
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      setMessage('Введите URL веб-приложения');
      setMessageType('error');
      return;
    }

    setTesting(true);
    setMessage('');
    try {
      await api.saveConfig(scriptUrl.trim());
      const testResult = await api.testConnection();
      
      if (testResult.success) {
        setMessage('Подключение успешно установлено');
        setMessageType('success');
      } else {
        setMessage(testResult.error || 'Не удалось подключиться');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Ошибка подключения к серверу');
      setMessageType('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ScreenHeader icon="⚙️" title="Настройки и информация" onBack={onBack} />

      <div className="p-5 max-w-lg mx-auto">
        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Подключение к базе данных</h2>
          
          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">URL веб-приложения Google Apps Script</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
            />
          </div>

          {message && (
            <div className={`border rounded-lg p-3 mb-4 ${
              messageType === 'success' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm ${
                messageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {message}
              </p>
            </div>
          )}

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Проверка...
              </span>
            ) : (
              'Проверить подключение'
            )}
          </button>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Информация о приложении</h2>
          
          <div className="space-y-3">
            {/* «Название» и полное название — всегда в одну строку.
                Шрифт строки 14px, а на узких экранах уменьшается по ширине экрана,
                чтобы строка не переносилась (100vw − 88px — ширина строки в карточке). */}
            <div
              className="flex justify-between items-center gap-2 py-2 border-b border-slate-100 whitespace-nowrap"
              style={{ fontSize: 'min(0.875rem, calc((100vw - 88px) / 28))' }}
            >
              <span className="text-slate-500">Название</span>
              <span className="text-slate-800 font-medium">СМУм (система медицинского учета мобильная)</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Тип</span>
              <span className="text-sm text-slate-800 font-medium">Веб-приложение</span>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-500">Версия</span>
              <span className="text-sm text-green-600 font-medium">v. 0.1</span>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-5">
          © {new Date().getFullYear()} АлкоСпас • Выездная медицинская помощь
        </p>
      </div>
    </div>
  );
}
