import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { Nomenclature } from '../types';
import NetworkStatus from '../components/NetworkStatus';
import { logoutButtonClass } from '../components/ScreenHeader';

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
  // Окно «Внесите количество» — как в листе расхода: тап по названию +1, «−» убирает лишний тап
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCounts, setPickerCounts] = useState<Record<string, number>>({});

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

  // Изменить количество на delta (кнопки «−»/«+»); 0 — позиция уходит из списка добавленных
  const changeQuantity = (id: string, delta: number) => {
    const current = parseInt(quantities[id] ?? '0', 10) || 0;
    handleQuantityChange(id, String(Math.max(0, current + delta)));
  };

  const openPicker = () => {
    setPickerCounts({});
    setShowPicker(true);
  };

  // Набранное в окне прибавляется к уже внесённому количеству
  const closePicker = () => {
    Object.entries(pickerCounts).forEach(([id, count]) => {
      if (count > 0) changeQuantity(id, count);
    });
    setPickerCounts({});
    setShowPicker(false);
  };

  // В категории показываем только внесённые позиции; остальные сохранятся с количеством 0
  const addedItems = categoryItems.filter(item => (quantities[item.id] ?? '0') !== '0');

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
      {/* Название по центру, как в остальных разделах; «Выйти» справа */}
      <div className="bg-white px-2 py-4 border-b border-slate-200 grid grid-cols-[4.25rem_1fr_4.25rem] items-start gap-1">
        <div />
        <div className="flex flex-col items-center text-center">
          <h1 className="font-bold text-slate-800 leading-tight" style={{ fontSize: 'min(1.125rem, 5vw)' }}>Начальные остатки</h1>
          <p className="text-sm text-slate-500 mt-1">{employee?.fullName}</p>
          <NetworkStatus />
        </div>
        <button
          onClick={logout}
          className={`justify-self-end ${logoutButtonClass}`}
        >
          Выйти
        </button>
      </div>

      <div className="p-5 max-w-lg mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-blue-900 font-medium mb-1">Перед началом работы</p>
          <p className="text-sm text-blue-800 leading-relaxed">
            В каждой категории нажмите «+ Добавить» и отметьте позиции, которые есть у вас, затем сохраните категорию.
            Позиции, которые вы не добавили, сохранятся с количеством 0.
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
              <div className="bg-white p-5 rounded-xl border border-slate-200 mb-4">
                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mb-4 transition-colors"
                  onClick={openPicker}
                >
                  + Добавить
                </button>

                {addedItems.length === 0 && (
                  <p className="text-sm text-slate-500 text-center">Позиции не добавлены — в категории сохранится 0</p>
                )}

                {addedItems.map(item => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-lg mb-2 border border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">{item.name}</p>
                        {item.unit && <p className="text-xs text-slate-400">{item.unit}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {/* «−» на единице убирает позицию из списка (количество 0) */}
                        <button
                          type="button"
                          aria-label={`Убрать одну: ${item.name}`}
                          className="w-9 h-9 rounded-lg bg-red-600 active:bg-red-700 hover:bg-red-700 text-white text-xl font-bold leading-none flex items-center justify-center transition-colors"
                          onClick={() => changeQuantity(item.id, -1)}
                        >
                          −
                        </button>
                        {/* Текстовое поле с цифровой клавиатурой — без стрелок вверх/вниз */}
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`Количество: ${item.name}`}
                          value={quantities[item.id] ?? '0'}
                          onChange={event => handleQuantityChange(item.id, event.target.value)}
                          className="w-14 text-lg font-bold text-blue-700 bg-blue-50 px-1 py-1 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          aria-label={`Добавить одну: ${item.name}`}
                          className="w-9 h-9 rounded-lg bg-green-600 active:bg-green-700 hover:bg-green-700 text-white text-xl font-bold leading-none flex items-center justify-center transition-colors"
                          onClick={() => changeQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
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

      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Внесите количество</h3>
            <p className="text-sm text-slate-500 mb-3">Нажмите на название, чтобы добавить 1</p>
            <div className="overflow-y-auto flex-1">
              {categoryItems.map(item => {
                const count = pickerCounts[item.id] || 0;
                const changeCount = (delta: number) => setPickerCounts(prev => ({
                  ...prev,
                  [item.id]: Math.max(0, (prev[item.id] || 0) + delta),
                }));
                return (
                  <div
                    key={item.id}
                    className={`border-b border-slate-200 flex items-center gap-2 ${count > 0 ? 'bg-blue-50' : ''}`}
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 p-4 text-left select-none active:bg-blue-100 transition-colors"
                      onClick={() => changeCount(1)}
                    >
                      <span className="text-base text-slate-800 font-medium block truncate">{item.name}</span>
                      {item.unit && <span className="text-xs text-slate-400 block">{item.unit}</span>}
                    </button>
                    {count > 0 && (
                      <button
                        type="button"
                        aria-label={`Убрать одну: ${item.name}`}
                        className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 bg-white text-xl font-bold text-slate-600 active:bg-slate-100"
                        onClick={() => changeCount(-1)}
                      >
                        −
                      </button>
                    )}
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={count}
                      aria-label={`Добавить количество: ${item.name}`}
                      className={`w-14 mr-4 shrink-0 border rounded-lg p-2 text-center pointer-events-none select-none ${
                        count > 0 ? 'border-blue-300 bg-white text-blue-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mt-4 transition-colors"
              onClick={closePicker}
            >
              Сохранить и закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
