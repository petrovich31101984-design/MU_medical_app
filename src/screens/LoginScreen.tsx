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

    // Проверяем, что база данных подключена
    const configUrl = api.getConfigUrl();
    if (!configUrl) {
      setError('База данных не подключена. Обратитесь к администратору.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Отправляем обычный пароль - Apps Script сам его захэширует и сравнит с хэшем в БД
      const response = await api.authenticateEmployee(personalNumber, password);
      
      console.log('=== LOGIN RESPONSE ===');
      console.log('Full response:', response);
      console.log('Success:', response.success);
      console.log('Error:', response.error);
      console.log('Data:', response.data);
      
      // Если API вернул ошибку
      if (!response.success) {
        console.log('API returned error:', response.error);
        setError(response.error || 'Ошибка подключения к базе данных');
        setLoading(false);
        return;
      }

      // Если нет данных
      if (!response.data) {
        console.log('No data in response');
        setError('Неверный персональный номер или пароль');
        setLoading(false);
        return;
      }

      // Проверяем, что данные содержат обязательные поля сотрудника
      let data = response.data as any;
      
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      console.log('Data keys:', Object.keys(data));
      
      // Если Apps Script вернул массив, берём первый элемент
      if (Array.isArray(data)) {
        console.log('Data is array, taking first element');
        data = data[0];
      }
      
      // Если Apps Script вернул объект с полем data внутри
      if (data.data && typeof data.data === 'object') {
        console.log('Data has nested data field');
        data = data.data;
      }
      
      // Если Apps Script вернул ошибку внутри data
      if (data.success === false || data.error) {
        console.log('Apps Script returned error:', data.error);
        setError(data.error || 'Неверный персональный номер или пароль');
        setLoading(false);
        return;
      }

      console.log('Final employee data:', data);

      // Проверяем наличие хотя бы id (минимальное требование)
      if (!data.id) {
        console.error('No id in employee data:', data);
        setError('Неверный персональный номер или пароль');
        setLoading(false);
        return;
      }

      console.log('Login successful, employee data:', data);
      
      if (data.blocked) {
        setError('Ваш аккаунт заблокирован');
        setLoading(false);
        return;
      }

      if (data.status === 'Уволен') {
        setError('Ваш аккаунт уволен');
        setLoading(false);
        return;
      }

      // Убеждаемся, что передаем все данные с поддержкой альтернативных имен полей
      const employeeData = {
        ...data,
        fullName: data.fullName || data.full_name || data.name || '',
        personalNumber: data.personalNumber || data.personal_number || personalNumber,
      };
      
      console.log('Calling login with:', employeeData);
      await login(employeeData);
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка подключения к базе данных. Проверьте соединение и попробуйте снова.');
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
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg w-full transition-colors disabled:opacity-50 mt-2"
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
