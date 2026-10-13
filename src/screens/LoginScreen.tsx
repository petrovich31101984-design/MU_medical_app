import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../api';

export default function LoginScreen() {
  const [personalNumber, setPersonalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!personalNumber.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.authenticateEmployee(personalNumber, password);
      
      if (response.success && response.data) {
        console.log('Login response data:', response.data);
        console.log('Full name:', response.data.fullName);
        console.log('All fields:', Object.keys(response.data));
        
        if (response.data.blocked) {
          setError('Ваш аккаунт заблокирован');
          setLoading(false);
          return;
        }

        if (response.data.status === 'Уволен') {
          setError('Ваш аккаунт уволен');
          setLoading(false);
          return;
        }

        // Убеждаемся, что передаем все данные
        const employeeData = {
          ...response.data,
          fullName: response.data.fullName || '',
        };
        
        console.log('Calling login with:', employeeData);
        await login(employeeData);
      } else {
        setError(response.error || 'Неверный персональный номер или пароль');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-5">
      <div className="flex flex-col items-center mt-8">
        <img
          src="https://raw.githubusercontent.com/petrovich31101984-design/MU_medical_app/creating-a-project-from-github-c0204/public/logo.png"
          alt="АлкоСпас"
          className="w-32 h-32 mb-5 drop-shadow-lg rounded-2xl"
        />
        <h1 className="text-3xl font-bold mb-1">
          <span className="text-blue-700">Алко</span>
          <span className="text-red-600">Спас</span>
        </h1>
        <p className="text-sm text-slate-500">Система медицинского учета</p>
      </div>

      <div className="max-w-md mx-auto w-full mb-10">
        <div className="mb-5">
          <label className="text-sm text-slate-500 mb-2 block">Персональный номер</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg p-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            placeholder="Введите номер"
          />
        </div>

        <div className="mb-5">
          <label className="text-sm text-slate-500 mb-2 block">Пароль</label>
          <input
            type="password"
            className="w-full border border-slate-200 rounded-lg p-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg w-full transition-colors disabled:opacity-50 mt-2"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Вход...
            </span>
          ) : (
            'Войти'
          )}
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs">
        © {new Date().getFullYear()} АлкоСпас • Выездная медицинская помощь <span className="text-green-600">(v. 0.1)</span>
      </p>
    </div>
  );
}
