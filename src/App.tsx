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

type Screen = 'Setup' | 'Login' | 'Home' | 'ExpenseSheet' | 'Messages' | 'Announcements' | 'Profile' | 'Return';

export default function App() {
  const { isAuthenticated, loadSession } = useAuthStore();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('Login');

  useEffect(() => {
    const init = async () => {
      await api.initialize();
      await loadSession();
      
      const url = api.getConfigUrl();
      if (!url) {
        setIsConfigured(false);
      } else {
        const testResult = await api.testConnection();
        setIsConfigured(testResult.success);
      }
    };
    
    init();
  }, []);

  useEffect(() => {
    if (isConfigured === true) {
      setCurrentScreen(isAuthenticated ? 'Home' : 'Login');
    }
  }, [isAuthenticated, isConfigured]);

  const handleConnected = () => {
    setIsConfigured(true);
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
    return <SetupScreen onConnected={handleConnected} />;
  }

  // Рендер текущего экрана
  const renderScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return <LoginScreen />;
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
