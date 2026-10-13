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
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">А</span>
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
