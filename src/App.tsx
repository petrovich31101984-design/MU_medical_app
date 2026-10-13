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

type Screen = 'Setup' | 'Login' | 'Home' | 'ExpenseSheet' | 'Messages' | 'Announcements' | 'Profile';

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
            
            {/* Синяя дуга - внешняя */}
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
              <div className="w-full h-full rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600"></div>
            </div>
            
            {/* Красная дуга - внутренняя (с отступом для расстояния) */}
            <div className="absolute inset-3 animate-spin" style={{ animationDuration: '2s' }}>
              <div className="w-full h-full rounded-full border-4 border-transparent border-b-red-600 border-l-red-600"></div>
            </div>
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
