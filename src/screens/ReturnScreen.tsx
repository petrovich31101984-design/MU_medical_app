import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../api';
import { Nomenclature } from '../types';

interface ReturnScreenProps {
  onBack: () => void;
}

type ReturnCategory = 'medicines' | 'supplies' | 'equipment';

const RETURN_CATEGORIES: { id: ReturnCategory; label: string }[] = [
  { id: 'medicines', label: 'Лекарственные средства (ЛС)' },
  { id: 'supplies', label: 'Расходники' },
  { id: 'equipment', label: 'Оборудование' },
];

const getNomenclatureName = (item: Nomenclature) => {
  const data = item as unknown as Record<string, unknown>;
  return String(item.name || data['Название'] || data['Наименование'] || '').trim();
};

const getReturnCategory = (item: Nomenclature): ReturnCategory | '' => {
  const category = String(item.category || (item as unknown as Record<string, unknown>)['Категория'] || '')
    .trim()
    .toLowerCase();
  if (category === 'лс' || category.startsWith('лс ') || category.includes('лекарствен')) return 'medicines';
  if (category === 'расходники' || category === 'расходные материалы') return 'supplies';
  if (category === 'оборудование') return 'equipment';
  return '';
};

export default function ReturnScreen({ onBack }: ReturnScreenProps) {
  const { employee } = useAuthStore();
  const { nomenclature, loading: nomenclatureLoading, loadNomenclature } = useDataStore();
  const [nomenclatureName, setNomenclatureName] = useState('');
  const [nomenclatureId, setNomenclatureId] = useState('');
  const [nomenclatureUnit, setNomenclatureUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ReturnCategory | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadNomenclature();
  }, []);

  const handleSubmit = async () => {
    if (!nomenclatureName.trim() || !nomenclatureId) {
      setError('Выберите название номенклатуры');
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('Введите корректное количество');
      return;
    }

    if (!reason.trim()) {
      setError('Введите причину возврата');
      return;
    }

    if (!employee) {
      setError('Сотрудник не авторизован');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.createReturn({
        employeeId: employee.id,
        employeeName: employee.fullName,
        nomenclatureId,
        nomenclatureName: nomenclatureName.trim(),
        unit: nomenclatureUnit,
        quantity: parsedQuantity,
        reason: reason.trim(),
      });

      if (!response.success) {
        setError(response.error || 'Не удалось оформить возврат');
        return;
      }

      setSuccess(response.queued
        ? 'Возврат сохранён на устройстве и будет отправлен позже'
        : 'Возврат успешно оформлен');
      setNomenclatureName('');
      setNomenclatureId('');
      setNomenclatureUnit('');
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

  if (selectedCategory) {
    const category = RETURN_CATEGORIES.find(item => item.id === selectedCategory)!;
    const categoryItems = nomenclature
      .filter(item => getReturnCategory(item) === selectedCategory && getNomenclatureName(item))
      .sort((a, b) => getNomenclatureName(a).localeCompare(getNomenclatureName(b), 'ru'));

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white p-4 border-b border-slate-200 flex items-center">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            ← Назад
          </button>
          <h1 className="text-lg font-bold text-slate-800">{category.label}</h1>
        </div>

        <div className="p-5 max-w-lg mx-auto">
          <p className="text-sm text-slate-500 mb-4">Выберите номенклатуру для возврата</p>
          {nomenclatureLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              Загрузка номенклатуры...
            </div>
          ) : categoryItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              В этой категории нет номенклатуры
            </div>
          ) : (
            <div className="space-y-3">
              {categoryItems.map((item, index) => {
                const data = item as unknown as Record<string, unknown>;
                const name = getNomenclatureName(item);
                return (
                  <button
                    key={String(item.id || data['ID'] || `${name}-${index}`)}
                    onClick={() => {
                      setNomenclatureName(name);
                      setNomenclatureId(String(item.id || data['ID'] || ''));
                      setNomenclatureUnit(String(item.unit || data['Ед. измерения'] || data['Ед. изм.'] || ''));
                      setSelectedCategory(null);
                      setError('');
                    }}
                    className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left font-medium text-slate-800 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Форма возврата</h2>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Название номенклатуры *</label>
            {nomenclatureName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-blue-800 font-medium">
                {nomenclatureName}
              </div>
            )}
            <select
              className="w-full border border-slate-200 rounded-lg p-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value=""
              onChange={event => {
                if (event.target.value) setSelectedCategory(event.target.value as ReturnCategory);
              }}
              disabled={nomenclatureLoading}
            >
              <option value="" hidden>
                Выберите категорию
              </option>
              {RETURN_CATEGORIES.map(category => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
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
