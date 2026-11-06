import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { api } from './api';

// Экраны
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ExpenseSheetScreen from './screens/ExpenseSheetScreen';
import MessagesScreen from './screens/MessagesScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SetupScreen from './screens/SetupScreen';
import ReturnScreen from './screens/ReturnScreen';
import SettingsScreen from './screens/SettingsScreen';
import InitialStockScreen from './screens/InitialStockScreen';

type Screen = 'Setup' | 'Login' | 'Home' | 'ExpenseSheet' | 'Messages' | 'Announcements' | 'Profile' | 'Return' | 'Settings' | 'InitialStock';
type InitialStockStatus = 'checking' | 'required' | 'completed' | 'error';

export default function App() {
  const { isAuthenticated, employee, loadSession, logout } = useAuthStore();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('Login');
  const [initialStockStatus, setInitialStockStatus] = useState<InitialStockStatus>('checking');
  const [stockCheckAttempt, setStockCheckAttempt] = useState(0);

  useEffect(() => {
    // Инициализация API
    api.initialize().then(() => {
      // Загрузка сессии
      loadSession().then(() => {
        const url = api.getConfigUrl();
        // Если нет URL, показываем экран настройки
        if (!url) {
          setIsConfigured(false);
        } else {
          // Если есть URL, показываем экран входа
          setIsConfigured(true);
        }
      });
    }).catch(error => {
      console.error('Init error:', error);
      setIsConfigured(false);
    });
  }, []);

  useEffect(() => {
    if (isConfigured !== true) return;

    if (!isAuthenticated) {
      setInitialStockStatus('checking');
      setCurrentScreen('Login');
      return;
    }

    if (!employee) return;

    let cancelled = false;
    setInitialStockStatus('checking');

    api.hasInitialStock(employee.id).then(response => {
      if (cancelled) return;

      if (!response.success) {
        setInitialStockStatus('error');
        return;
      }

      if (response.data) {
        setInitialStockStatus('completed');
        setCurrentScreen(current => current === 'Login' || current === 'InitialStock' ? 'Home' : current);
      } else {
        setInitialStockStatus('required');
        setCurrentScreen('InitialStock');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isConfigured, employee?.id, stockCheckAttempt]);

  const handleConnected = () => {
    setIsConfigured(true);
    setCurrentScreen('Login');
  };

  const handleBackToLogin = () => {
    setCurrentScreen('Login');
  };

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as Screen);
  };

  const handleBack = () => {
    setCurrentScreen('Home');
  };

  // Если конфигурация ещё не загружена, показываем загрузку
  if (isConfigured === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            {/* Логотип в центре с мерцанием */}
            <img
              src="https://raw.githubusercontent.com/petrovich31101984-design/MU_medical_app/creating-a-project-from-github-c0204/public/logo.png"
              alt="АлкоСпас"
              className="w-24 h-24 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-pulse"
            />
            
            {/* SVG с двумя дугами */}
            <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 128 128">
              {/* Синяя дуга - 150° */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#2563eb"
                strokeWidth="4"
                strokeDasharray="146.6 205.3"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Красная дуга - 150° (разрыв 30°) */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#dc2626"
                strokeWidth="4"
                strokeDasharray="146.6 205.3"
                strokeDashoffset="-175.9"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-slate-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если не настроен URL, показываем экран настройки
  if (!isConfigured) {
    return <SetupScreen onConnected={handleConnected} onBack={handleBackToLogin} />;
  }

  if (isAuthenticated && initialStockStatus === 'checking') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-500">Проверка начальных остатков...</p>
      </div>
    );
  }

  if (isAuthenticated && initialStockStatus === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-5">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-3">Не удалось проверить остатки</h1>
          <p className="text-slate-500 mb-6">Проверьте подключение к базе данных и повторите попытку.</p>
          <button
            onClick={() => setStockCheckAttempt(attempt => attempt + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg w-full mb-3 transition-colors"
          >
            Повторить
          </button>
          <button onClick={logout} className="text-red-600 p-2 text-sm">Выйти</button>
        </div>
      </div>
    );
  }

  if (isAuthenticated && initialStockStatus === 'required') {
    return (
      <div className="min-h-screen bg-slate-50 max-w-lg mx-auto shadow-xl">
        <InitialStockScreen
          onComplete={() => {
            setInitialStockStatus('completed');
            setCurrentScreen('Home');
          }}
        />
      </div>
    );
  }

  // Рендер текущего экрана
  const renderScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return <LoginScreen onNavigate={handleNavigate} />;
      case 'Home':
        return <HomeScreen onNavigate={handleNavigate} />;
      case 'ExpenseSheet':
        return <ExpenseSheetScreen onBack={handleBack} />;
      case 'Messages':
        return <MessagesScreen onBack={handleBack} />;
      case 'Announcements':
        return <AnnouncementsScreen onBack={handleBack} />;
      case 'Profile':
        return <ProfileScreen onBack={handleBack} />;
      case 'Return':
        return <ReturnScreen onBack={handleBack} />;
      case 'Settings':
        return <SettingsScreen onBack={handleBack} />;
      case 'Setup':
        return <SetupScreen onConnected={handleConnected} onBack={handleBackToLogin} />;
      case 'InitialStock':
        return <InitialStockScreen onComplete={() => setCurrentScreen('Home')} />;
      default:
        return <HomeScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto shadow-xl">
      {renderScreen()}
    </div>
  );
}
