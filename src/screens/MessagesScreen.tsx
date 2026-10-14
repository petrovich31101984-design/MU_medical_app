import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ChatMessage } from '../types';

interface MessagesScreenProps {
  onBack: () => void;
}

export default function MessagesScreen({ onBack }: MessagesScreenProps) {
  const { employee } = useAuthStore();
  const { messages, loadMessages, sendMessage } = useDataStore();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (employee) {
      loadMessages(employee.id);
    }
  }, [employee]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !employee) return;

    const success = await sendMessage({
      fromId: employee.id,
      fromName: employee.fullName,
      toId: 'MGR',
      toName: 'Руководитель',
      role: 'Сотрудник',
      text: newMessage,
      read: false,
      priority: 'Обычное',
    });

    if (success) {
      setNewMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center">
        <button
          onClick={onBack}
          className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-bold text-slate-800">Сообщения</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-6xl mb-4">💬</span>
            <p className="text-slate-500 text-base">Нет сообщений</p>
            <p className="text-slate-400 text-sm mt-2">Начните переписку с руководителем</p>
          </div>
        ) : (
          sortedMessages.map((item: ChatMessage) => {
            const isOwn = item.fromId === employee?.id;
            return (
              <div
                key={item.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl ${
                    isOwn
                      ? 'bg-blue-600 rounded-br-sm'
                      : 'bg-white border border-slate-200 rounded-bl-sm'
                  }`}
                >
                  <p className={`text-base ${isOwn ? 'text-white' : 'text-slate-800'}`}>
                    {item.text}
                  </p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
                    {new Date(item.date).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white p-4 border-t border-slate-200 flex items-end gap-2">
        <textarea
          className="flex-1 bg-slate-50 rounded-full px-4 py-2 resize-none max-h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение..."
          rows={1}
        />
        <button
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            newMessage.trim()
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-200 text-slate-400'
          }`}
          onClick={handleSend}
          disabled={!newMessage.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
