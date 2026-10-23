import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ChatMessage } from '../types';

interface MessagesScreenProps {
  onBack: () => void;
}

export default function MessagesScreen({ onBack }: MessagesScreenProps) {
  const { employee } = useAuthStore();
  const { messages, loadMessages, sendMessage, editMessage, deleteMessage } = useDataStore();
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<'MGR' | 'STORE'>('MGR');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [contextMenuMessageId, setContextMenuMessageId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const recipients = {
    MGR: { id: 'MGR', name: 'Руководитель', icon: '👔' },
    STORE: { id: 'STORE', name: 'Кладовщик', icon: '📦' },
  };

  useEffect(() => {
    if (employee) {
      loadMessages(employee.id);
      
      // Автоматическое обновление сообщений каждые 5 секунд
      const interval = setInterval(() => {
        loadMessages(employee.id);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [employee]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !employee) return;

    console.log('=== MESSAGE SCREEN: Sending message ===');
    console.log('New message:', newMessage);
    console.log('Selected recipient:', selectedRecipient);
    
    const messageText = newMessage; // Сохраняем текст перед очисткой
    setNewMessage(''); // Очищаем поле сразу
    
    const recipient = recipients[selectedRecipient];
    const success = await sendMessage({
      fromId: employee.id,
      fromName: employee.fullName,
      toId: recipient.id,
      toName: recipient.name,
      role: 'Сотрудник',
      text: messageText,
      read: false,
      priority: 'Обычное',
    });

    console.log('Send result:', success);

    if (success) {
      console.log('Message sent successfully');
    } else {
      console.error('Failed to send message');
      setNewMessage(messageText); // Возвращаем текст, если отправка не удалась
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEdit = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingText(message.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingText.trim()) return;
    
    const success = await editMessage(editingMessageId, editingText);
    if (success) {
      setEditingMessageId(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleDelete = async (messageId: string) => {
    if (confirm('Вы уверены, что хотите удалить сообщение?')) {
      await deleteMessage(messageId);
      setContextMenuMessageId(null);
    }
  };

  const handleLongPressStart = (messageId: string) => {
    longPressTimerRef.current = window.setTimeout(() => {
      setContextMenuMessageId(messageId);
    }, 500); // 500ms для long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenuAction = (action: 'edit' | 'delete', messageId: string) => {
    setContextMenuMessageId(null);
    if (action === 'edit') {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        handleEdit(message);
      }
    } else if (action === 'delete') {
      handleDelete(messageId);
    }
  };

  const filteredMessages = messages.filter(msg => 
    msg.toId === selectedRecipient || msg.fromId === selectedRecipient
  );

  console.log('=== MESSAGE FILTERING ===');
  console.log('All messages count:', messages.length);
  console.log('Selected recipient:', selectedRecipient);
  console.log('Filtered messages count:', filteredMessages.length);
  if (filteredMessages.length > 0) {
    console.log('First filtered message:', filteredMessages[0]);
  }

  const sortedMessages = [...filteredMessages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            ← Назад
          </button>
          <h1 className="text-lg font-bold text-slate-800">Сообщения</h1>
        </div>
        <button
          onClick={() => employee && loadMessages(employee.id)}
          className="text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          title="Обновить сообщения"
        >
          🔄
        </button>
      </div>

      {/* Выбор получателя */}
      <div className="bg-white p-3 border-b border-slate-200">
        <p className="text-xs text-slate-500 mb-2">Получатель:</p>
        <div className="flex gap-2">
          {Object.entries(recipients).map(([key, recipient]) => (
            <button
              key={key}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedRecipient === key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setSelectedRecipient(key as 'MGR' | 'STORE')}
            >
              <span className="mr-1">{recipient.icon}</span>
              {recipient.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-6xl mb-4">💬</span>
            <p className="text-slate-500 text-base">Нет сообщений</p>
            <p className="text-slate-400 text-sm mt-2">Начните переписку с {recipients[selectedRecipient].name.toLowerCase()}</p>
          </div>
        ) : (
          sortedMessages.map((item: ChatMessage) => {
            const isOwn = item.fromId === employee?.id;
            const isEditing = editingMessageId === item.id;
            
            return (
              <div
                key={item.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[80%]">
                  {isEditing ? (
                    <div className="bg-white border border-blue-500 rounded-xl p-3">
                      <textarea
                        className="w-full p-2 border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                          onClick={handleSaveEdit}
                        >
                          Сохранить
                        </button>
                        <button
                          className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium py-2 rounded-lg transition-colors"
                          onClick={handleCancelEdit}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-xl cursor-pointer select-none ${
                        isOwn
                          ? 'bg-blue-600 rounded-br-sm'
                          : 'bg-white border border-slate-200 rounded-bl-sm'
                      } ${contextMenuMessageId === item.id ? 'ring-2 ring-blue-400' : ''}`}
                      onMouseDown={() => isOwn && handleLongPressStart(item.id)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => isOwn && handleLongPressStart(item.id)}
                      onTouchEnd={handleLongPressEnd}
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
                  )}
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

      {/* Контекстное меню для сообщений */}
      {contextMenuMessageId && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setContextMenuMessageId(null)}
        >
          <div 
            className="bg-white rounded-xl p-2 w-48 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-lg transition-colors text-left"
              onClick={() => handleContextMenuAction('edit', contextMenuMessageId)}
            >
              <span className="text-xl">✏️</span>
              <span className="text-base text-slate-800">Редактировать</span>
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg transition-colors text-left"
              onClick={() => handleContextMenuAction('delete', contextMenuMessageId)}
            >
              <span className="text-xl">🗑️</span>
              <span className="text-base text-red-600">Удалить</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
