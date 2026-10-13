import React, { useState } from 'react';
import { api } from '../api';

interface SetupScreenProps {
  onConnected: () => void;
}

export default function SetupScreen({ onConnected }: SetupScreenProps) {
  const [scriptUrl, setScriptUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!scriptUrl.trim()) {
      setError('Введите URL веб-приложения');
      return;
    }

    setTesting(true);
    setError('');
    try {
      await api.saveConfig(scriptUrl.trim());
      const testResult = await api.testConnection();
      
      if (testResult.success) {
        onConnected();
      } else {
        setError(testResult.error || 'Не удалось подключиться');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-5">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.svg"
            alt="АлкоСпас"
            className="w-24 h-24 mb-4 drop-shadow-lg"
          />
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            АлкоСпас
          </h1>
          <p className="text-base text-slate-500 text-center">
            Система медицинского учета
          </p>
        </div>

        <h2 className="text-xl font-bold text-slate-800 text-center mb-2">
          Настройка подключения
        </h2>
        <p className="text-base text-slate-500 text-center mb-8">
          Введите URL веб-приложения Google Apps Script
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
          <p className="text-base font-bold text-slate-800 mb-2">Инструкция:</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            1. Откройте Google Sheets с базой данных<br />
            2. Расширения → Apps Script<br />
            3. Развернуть → Новое развертывание<br />
            4. Тип: Веб-приложение<br />
            5. Скопируйте URL и вставьте ниже
          </p>
        </div>

        <div className="mb-4">
          <label className="text-sm text-slate-500 mb-2 block">URL веб-приложения</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg p-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={scriptUrl}
            onChange={(e) => setScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg w-full transition-colors disabled:opacity-50"
          onClick={handleConnect}
          disabled={testing}
        >
          {testing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Подключение...
            </span>
          ) : (
            'Подключиться'
          )}
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs">
        © {new Date().getFullYear()} АлкоСпас • Выездная медицинская помощь
      </p>
    </div>
  );
}
