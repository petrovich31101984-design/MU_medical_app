import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface ReturnScreenProps {
  onBack: () => void;
}

export default function ReturnScreen({ onBack }: ReturnScreenProps) {
  const { employee } = useAuthStore();
  const [nomenclatureName, setNomenclatureName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!nomenclatureName.trim()) {
      setError('Введите название номенклатуры');
      return;
    }

    if (!quantity.trim() || parseInt(quantity) <= 0) {
      setError('Введите корректное количество');
      return;
    }

    if (!reason.trim()) {
      setError('Введите причину возврата');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Здесь будет логика отправки возврата на сервер
      // Пока просто имитируем успешную отправку
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess('Возврат успешно оформлен');
      setNomenclatureName('');
      setQuantity('');
      setReason('');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError('Ошибка при оформлении возврата');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white p-4 border-b border-slate-200 flex items-center">
        <button
          onClick={onBack}
          className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-bold text-slate-800">Оформить возврат</h1>
      </div>

      <div className="p-5 max-w-lg mx-auto">
        {/* Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Форма возврата</h2>
          
          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Название номенклатуры *</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nomenclatureName}
              onChange={(e) => setNomenclatureName(e.target.value)}
              placeholder="Введите название препарата"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Количество *</label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Введите количество"
              min="1"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Причина возврата *</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Опишите причину возврата"
              rows={4}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Отправка...
              </span>
            ) : (
              'Оформить возврат'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
