import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { Nomenclature } from '../types';
import NetworkStatus from '../components/NetworkStatus';

interface InitialStockScreenProps {
  onComplete: () => void;
}

type StockCategory = 'medicines' | 'supplies' | 'equipment';

const STOCK_CATEGORIES: { id: StockCategory; label: string }[] = [
  { id: 'medicines', label: 'Лекарственные средства (ЛС)' },
  { id: 'supplies', label: 'Расходники' },
  { id: 'equipment', label: 'Оборудование' },
];

const getField = (item: Nomenclature, ...keys: string[]): unknown => {
  const data = item as unknown as Record<string, unknown>;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return data[key];
    }
  }
  return '';
};

const isActive = (item: Nomenclature) => {
  const value = getField(item, 'active', 'Актуальна');
  return value === true || ['да', 'true', 'активна', 'активен'].includes(String(value).trim().toLowerCase());
};

const getStockCategory = (value: unknown): StockCategory | '' => {
  const category = String(value).trim().toLowerCase();

  if (category === 'лс' || category.startsWith('лс ') || category.includes('лекарствен')) {
    return 'medicines';
  }
  if (category === 'расходники' || category === 'расходный материал' || category === 'расходные материалы') {
    return 'supplies';
  }
  if (category === 'оборудование') {
    return 'equipment';
  }

  return '';
};

export default function InitialStockScreen({ onComplete }: InitialStockScreenProps) {
  const { employee, logout } = useAuthStore();
  const { nomenclature, loading, loadNomenclature } = useDataStore();
  const [selectedCategory, setSelectedCategory] = useState<StockCategory | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [completedCategories, setCompletedCategories] = useState<StockCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNomenclature();
  }, []);

  const items = useMemo(() => nomenclature
    .filter(isActive)
    .map(item => ({
      id: String(getField(item, 'id', 'ID')).trim(),
      name: String(getField(item, 'name', 'Название', 'Наименование')).trim(),
      category: getStockCategory(getField(item, 'category', 'Категория')),
      unit: String(getField(item, 'unit', 'Ед. измерения')).trim(),
      manufacturer: String(getField(item, 'manufacturer', 'Производитель')).trim(),
    }))
    .filter(item => item.id && item.name && item.category)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru')), [nomenclature]);

  useEffect(() => {
    setQuantities(previous => Object.fromEntries(
      items.map(item => [item.id, previous[item.id] ?? '0'])
    ));
  }, [items]);

  const categoryItems = selectedCategory
    ? items.filter(item => item.category === selectedCategory)
    : [];
  const selectedCategoryLabel = STOCK_CATEGORIES.find(category => category.id === selectedCategory)?.label;

  const handleQuantityChange = (id: string, value: string) => {
    if (/^\d*$/.test(value)) {
      setQuantities(previous => ({ ...previous, [id]: value }));
      const category = items.find(item => item.id === id)?.category;
      if (category) {
        setCompletedCategories(previous => previous.filter(item => item !== category));
      }
      setError('');
    }
  };

  const handleCategoryComplete = () => {
    if (!selectedCategory) return;

    if (categoryItems.some(item => !/^\d+$/.test(quantities[item.id] ?? ''))) {
      setError('Укажите целое неотрицательное количество для каждой позиции в категории');
      return;
    }

    setCompletedCategories(previous => previous.includes(selectedCategory)
      ? previous
      : [...previous, selectedCategory]
    );
    setSelectedCategory(null);
    setError('');
  };

  const handleSubmit = async () => {
    if (!employee || items.length === 0) return;

    if (completedCategories.length !== STOCK_CATEGORIES.length) {
      setError('Заполните и сохраните все три категории перед переходом на главный экран');
      return;
    }

    if (items.some(item => !/^\d+$/.test(quantities[item.id] ?? ''))) {
      setError('Укажите целое неотрицательное количество для каждой позиции номенклатуры');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.saveInitialStock(
        employee.id,
        employee.fullName,
        items.map(item => ({
          nomenclatureId: item.id,
          name: item.name,
          category: STOCK_CATEGORIES.find(category => category.id === item.category)?.label || item.category,
          unit: item.unit,
          quantity: Number(quantities[item.id]),
        }))
      );

      if (response.success) {
        onComplete();
      } else {
        setError(response.error || 'Не удалось сохранить начальные остатки');
      }
    } catch (err) {
      setError('Ошибка сохранения начальных остатков. Проверьте соединение и повторите попытку.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-white p-5 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Начальные остатки</h1>
            <p className="text-sm text-slate-500 mt-1">{employee?.fullName}</p>
            <NetworkStatus />
          </div>
          <button
            onClick={logout}
            className="text-red-600 text-sm p-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="p-5 max-w-lg mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-blue-900 font-medium mb-1">Перед началом работы</p>
          <p className="text-sm text-blue-800 leading-relaxed">
            Укажите количество и сохраните каждую категорию. Если позиции нет, оставьте 0.
            Переход на главный экран станет доступен после сохранения всех категорий.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Загрузка номенклатуры...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className="text-slate-600 mb-4">Активная номенклатура не найдена или список не удалось загрузить.</p>
            <button
              onClick={loadNomenclature}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition-colors"
            >
              Обновить список
            </button>
          </div>
        ) : selectedCategory === null ? (
          <div className="space-y-3 mb-5">
            <p className="text-sm text-slate-500">
              Заполнено категорий: {completedCategories.length} из {STOCK_CATEGORIES.length}
            </p>
            {STOCK_CATEGORIES.map(category => {
              const completed = completedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setError('');
                  }}
                  className="w-full bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-bold text-slate-800">{category.label}</span>
                  <span className={`text-sm ml-3 whitespace-nowrap ${completed ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                    {completed ? '✓ Сохранено' : '→'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-5">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-blue-600 text-sm p-2 mb-2 hover:bg-blue-50 rounded-lg transition-colors"
            >
              ← Все категории
            </button>
            <div className="mb-3 px-1">
              <h2 className="font-bold text-slate-800">{selectedCategoryLabel}</h2>
            </div>

            {categoryItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-slate-500 mb-4">
                В этой категории нет активной номенклатуры
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {categoryItems.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="mb-3">
                      <h3 className="font-bold text-slate-800">{item.name}</h3>
                      {item.manufacturer && (
                        <p className="text-sm text-slate-500 mt-1">{item.manufacturer}</p>
                      )}
                    </div>
                    <label className="text-sm text-slate-600 mb-2 block" htmlFor={`stock-${item.id}`}>
                      Количество{item.unit ? `, ${item.unit}` : ''}
                    </label>
                    <input
                      id={`stock-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      className="w-full border border-slate-200 rounded-lg p-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={quantities[item.id] ?? '0'}
                      onChange={event => handleQuantityChange(item.id, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg w-full transition-colors"
              onClick={handleCategoryComplete}
            >
              Сохранить категорию
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {items.length > 0 && selectedCategory === null && (
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg w-full transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={saving || loading || completedCategories.length !== STOCK_CATEGORIES.length}
          >
            {saving ? 'Сохранение...' : 'Сохранить и перейти на главный экран'}
          </button>
        )}
      </div>
    </div>
  );
}
