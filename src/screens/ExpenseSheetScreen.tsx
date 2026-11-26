import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ExpenseItem, ExpenseSheet, Nomenclature } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { servicePriceCategory } from '../data/defaultServices';

interface ExpenseSheetScreenProps {
  onBack: () => void;
  sheet?: ExpenseSheet;
}

const formatBirthDate = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

// В лист расхода выбираются только ЛС ПКУ, ЛС и расходники (оборудование — нет).
// Расходники в таблице могут называться «Расходники», «Расходный материал», «Расходные материалы».
const isExpenseCategory = (nom: Nomenclature) => {
  const data = nom as unknown as Record<string, unknown>;
  const category = String(nom.category || data['Категория'] || '').trim().toLowerCase();
  return category === 'лс пку' || category === 'лс' || category.startsWith('расход');
};

// Порядок в окне «Внесите количество»: ЛС ПКУ → ЛС (ампулы) → ЛС (штуки и др.) → расходные материалы;
// внутри группы — по алфавиту
const pickerGroup = (nom: Nomenclature) => {
  const data = nom as unknown as Record<string, unknown>;
  const category = String(nom.category || data['Категория'] || '').trim().toLowerCase();
  const unit = String(nom.unit || data['Ед. измерения'] || '').trim().toLowerCase();
  if (category === 'лс пку') return 0;
  if (category === 'лс') return unit.startsWith('ампул') ? 1 : 2;
  return 3;
};

// Полная существующая дата «ДД.ММ.ГГГГ», не в будущем и не раньше 1900 года
const isValidBirthDate = (value: string) => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  return year >= 1900 && date.getTime() <= Date.now();
};

const formatStoredBirthDate = (value: string) => {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}`;
  return formatBirthDate(value);
};

// Категории, для которых сотрудник выбирает услугу. Варианты берутся из «Прайса услуг»
// (управляет руководитель), стоимость считает таблица.
const CATEGORIES_WITH_THERAPY = ['Вызов однократно', 'Вызов + повторы', 'Курс', 'Госпитализация', 'Неустойка', 'Мед. отвод'];
const THERAPY_LABELS: Record<string, { label: string; placeholder: string }> = {
  'Госпитализация': { label: 'Вид госпитализации', placeholder: 'Выберите вид госпитализации' },
  'Неустойка': { label: 'Вид неустойки', placeholder: 'Выберите вид неустойки' },
  'Мед. отвод': { label: 'Вид мед. отвода', placeholder: 'Выберите вид мед. отвода' },
};
const therapyLabel = (category: string) =>
  THERAPY_LABELS[category] || { label: 'Название терапии', placeholder: 'Выберите тип терапии' };
// Для этих категорий лист расхода можно сохранить без препаратов
const CATEGORIES_WITHOUT_ITEMS = ['Госпитализация', 'Неустойка', 'Мед. отвод'];

export default function ExpenseSheetScreen({ onBack, sheet }: ExpenseSheetScreenProps) {
  const { employee } = useAuthStore();
  const { nomenclature, services, loading: nomenclatureLoading, loadNomenclature, loadServices, createExpenseSheet, updateExpenseSheet } = useDataStore();
  const isCreationBlocked = !sheet && !(employee?.status === 'Активен' || employee?.shiftOpen === true);

  const [patientName, setPatientName] = useState(sheet?.patientName || '');
  const [patientBirthDate, setPatientBirthDate] = useState(formatStoredBirthDate(sheet?.patientBirthDate || ''));
  const [callCategory, setCallCategory] = useState(sheet?.callCategory || '');
  const [therapyNames, setTherapyNames] = useState<string[]>(sheet?.therapyName ? sheet.therapyName.split(', ') : ['']);
  const [items, setItems] = useState<ExpenseItem[]>(sheet?.items || []);
  const [loading, setLoading] = useState(false);
  const [showNomenclaturePicker, setShowNomenclaturePicker] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    loadNomenclature();
    loadServices();
  }, []);

  // Услуги выбранной категории из прайса. В старом листе могла остаться услуга, которой в прайсе
  // уже нет (переименовали или удалили) — показываем её, чтобы выбор не сбрасывался.
  const priceCategory = servicePriceCategory(callCategory);
  const categoryServices = services.filter(s => s.category === priceCategory);
  const therapyOptions = [
    ...categoryServices.map(s => s.name),
    ...therapyNames.filter(n => n && !categoryServices.some(s => s.name === n)),
  ];
  // Если руководитель убрал из прайса все услуги категории, выбирать нечего — лист сохраняется без выбора
  const requiresTherapy = CATEGORIES_WITH_THERAPY.includes(callCategory) && therapyOptions.length > 0;

  const addItem = (nom: Nomenclature, quantity: number = 1, uniqueKey: string) => {
    const nomData = nom as any;
    const name = nomData.name || nomData.наименование || nomData.Наименование || nomData.productName || nomData.title || 'Препарат';
    const price = nomData.currentPrice || nomData.price || nomData.цена || nomData.Цена || 0;
    const category = nomData.category || nomData.категория || nomData.Категория || '';

    // В лист сохраняется настоящий код номенклатуры (NOM-...), а не «название_номер»:
    // иначе остатки руководителя сопоставлялись только по названию.
    const nomenclatureId = String(nomData.ID ?? nomData.id ?? '').trim() || uniqueKey;
    // Позиция уже есть в листе: по коду, а для старых листов — по названию
    const isSameItem = (item: ExpenseItem) => item.nomenclatureId === nomenclatureId || item.name === name;

    setItems(prevItems => {
      const existingItem = prevItems.find(isSameItem);

      if (existingItem) {
        // Позиция уже есть — суммируем количество (и переводим старую позицию на настоящий код)
        return prevItems.map(i =>
          isSameItem(i)
            ? { ...i, nomenclatureId, quantity: i.quantity + quantity, total: (i.quantity + quantity) * i.pricePerUnit }
            : i
        );
      } else {
        return [...prevItems, {
          nomenclatureId,
          name: name,
          category: category,
          quantity: quantity,
          pricePerUnit: price,
          total: price * quantity,
        }];
      }
    });
  };

  const updateQuantity = (nomenclatureId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(items.filter(i => i.nomenclatureId !== nomenclatureId));
    } else {
      setItems(items.map(i => 
        i.nomenclatureId === nomenclatureId 
          ? { ...i, quantity, total: quantity * i.pricePerUnit }
          : i
      ));
    }
  };

  const itemsOptional = CATEGORIES_WITHOUT_ITEMS.includes(callCategory);
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (isCreationBlocked) {
      setError('Для создания листа расхода откройте смену');
      return;
    }

    if (!patientName.trim()) {
      setError('Введите ФИО пациента');
      return;
    }

    if (!patientBirthDate.trim()) {
      setError('Введите дату рождения пациента');
      return;
    }

    if (!isValidBirthDate(patientBirthDate)) {
      setError('Проверьте дату рождения: нужна существующая дата в формате ДД.ММ.ГГГГ, не позже сегодняшнего дня');
      return;
    }

    // Стоимость терапии берётся из «Прайса услуг» по выбранной терапии, поэтому без неё лист не сохраняем
    const chosenTherapies = therapyNames.map(n => n.trim()).filter(Boolean);
    if (requiresTherapy && chosenTherapies.length === 0) {
      setError(therapyLabel(callCategory).placeholder);
      return;
    }
    // Коды услуг: по ним таблица находит цену, даже если услугу успели переименовать.
    // Если хоть у одной услуги кода нет (встроенный список) — таблица считает по названиям.
    const chosenIds = chosenTherapies.map(name => categoryServices.find(s => s.name === name)?.id || '');
    const serviceIds = chosenIds.every(Boolean) ? chosenIds : [];

    if (items.length === 0 && !itemsOptional) {
      setError('Добавьте хотя бы один препарат');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const sheetData = {
        employeeId: employee!.id,
        employeeName: employee!.fullName,
        patientName: patientName.trim(),
        patientBirthDate,
        date: sheet?.date || now.toISOString(),
        month: sheet?.month || month,
        callCategory,
        therapyName: chosenTherapies.join(', '),
        serviceIds,
        items,
        totalAmount,
        archived: sheet?.archived || false,
      };
      // Старая стоимость из кэша телефона в таблицу не отправляется — её пересчитает таблица
      const { therapyCost: _oldCost, ...sheetWithoutCost } = sheet || ({} as ExpenseSheet);
      const result = sheet
        ? await updateExpenseSheet({ ...sheetWithoutCost, ...sheetData })
        : await createExpenseSheet(sheetData);

      if (result) {
        setSuccess(sheet
          ? 'Изменения сохранены. При отсутствии сети они будут отправлены автоматически.'
          : 'Лист расхода сохранён. При отсутствии сети он будет отправлен автоматически после её восстановления.'
        );
        setTimeout(() => onBack(), 2000);
      } else {
        setError(sheet ? 'Не удалось сохранить изменения' : 'Не удалось создать лист расхода');
      }
    } catch (err) {
      setError(sheet ? 'Произошла ошибка при сохранении изменений' : 'Произошла ошибка при создании листа расхода');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ScreenHeader icon="📝" title={sheet ? 'Редактирование' : 'Лист расхода'} onBack={onBack} />

      <div className="p-5 max-w-lg mx-auto">
        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Информация о пациенте</h2>
          
          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">ФИО пациента *</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Дата рождения *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={patientBirthDate}
              onChange={(e) => setPatientBirthDate(formatBirthDate(e.target.value))}
              placeholder="ДД.ММ.ГГГГ"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Категория выезда</label>
            <button
              className="w-full py-3 px-4 rounded-lg border border-slate-200 text-left text-base transition-colors hover:bg-slate-50 flex justify-between items-center"
              onClick={() => setShowCategoryModal(true)}
            >
              <span className={callCategory ? 'text-slate-800' : 'text-slate-400'}>
                {callCategory || 'Выберите категорию'}
              </span>
              <span className="text-slate-400">▼</span>
            </button>
          </div>

          {showCategoryModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-5 w-full max-w-md">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Выберите категорию выезда</h3>
                <div className="space-y-2">
                  {['Вызов однократно', 'Вызов + повторы', 'Курс', 'Госпитализация', 'Мед. отвод', 'Неустойка'].map(cat => (
                    <button
                      key={cat}
                      className={`w-full py-3 px-4 rounded-lg border text-left text-base transition-colors ${
                        callCategory === cat
                          ? 'bg-blue-600 border-blue-600 text-white font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setCallCategory(cat);
                        setTherapyNames(['']);
                        setShowCategoryModal(false);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    className="w-full py-3 px-4 rounded-lg border border-red-200 text-left text-base transition-colors text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setCallCategory('');
                      setTherapyNames(['']);
                      setShowCategoryModal(false);
                    }}
                  >
                    Очистить
                  </button>
                </div>
                <button
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-lg mt-4 transition-colors"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {requiresTherapy && (
            <div className="mb-4">
              <label className="text-sm text-slate-500 mb-2 block">{therapyLabel(callCategory).label}</label>
              {(callCategory === 'Вызов + повторы' ? therapyNames : therapyNames.slice(0, 1)).map((name, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    className="flex-1 min-w-0 w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={name}
                    onChange={(e) => {
                      const newNames = [...therapyNames];
                      newNames[index] = e.target.value;
                      setTherapyNames(newNames);
                    }}
                  >
                    <option value="">{therapyLabel(callCategory).placeholder}</option>
                    {therapyOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {callCategory === 'Вызов + повторы' && (
                    <button
                      type="button"
                      className="w-12 h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center text-2xl"
                      onClick={() => setTherapyNames([...therapyNames, ''])}
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            Препараты и расходники
            {itemsOptional && <span className="block text-sm font-normal text-slate-500 mt-1">Необязательно для этой категории</span>}
          </h2>
          
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mb-4 transition-colors"
            onClick={() => setShowNomenclaturePicker(true)}
          >
            + Добавить
          </button>

          {[...items].sort((a, b) => {
            const russianAlphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
            const nameA = a.name.toUpperCase();
            const nameB = b.name.toUpperCase();
            
            for (let i = 0; i < Math.min(nameA.length, nameB.length); i++) {
              const charA = nameA[i];
              const charB = nameB[i];
              
              const indexA = russianAlphabet.indexOf(charA);
              const indexB = russianAlphabet.indexOf(charB);
              
              // Если оба символа в русском алфавите
              if (indexA !== -1 && indexB !== -1) {
                if (indexA !== indexB) {
                  return indexA - indexB;
                }
              } else if (indexA !== -1) {
                return -1; // Русские буквы перед другими
              } else if (indexB !== -1) {
                return 1;
              } else {
                // Оба символа не в русском алфавите, сравниваем обычно
                if (charA !== charB) {
                  return charA < charB ? -1 : 1;
                }
              }
            }
            
            return nameA.length - nameB.length;
          }).map(item => (
            <div key={item.nomenclatureId} className="bg-slate-50 p-3 rounded-lg mb-2 border border-slate-200">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-700 flex-1 min-w-0">{item.name}</p>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {/* «−» на единице убирает позицию из листа */}
                  <button
                    type="button"
                    aria-label={`Убрать одну: ${item.name}`}
                    className="w-9 h-9 rounded-lg bg-red-600 active:bg-red-700 hover:bg-red-700 text-white text-xl font-bold leading-none flex items-center justify-center transition-colors"
                    onClick={() => updateQuantity(item.nomenclatureId, item.quantity - 1)}
                  >
                    −
                  </button>
                  {/* Текстовое поле с цифровой клавиатурой — без стрелок вверх/вниз, как у type="number" */}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Количество: ${item.name}`}
                    value={item.quantity}
                    onChange={event => updateQuantity(item.nomenclatureId, parseInt(event.target.value.replace(/\D/g, '')) || 0)}
                    className="w-14 text-lg font-bold text-blue-700 bg-blue-50 px-1 py-1 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    aria-label={`Добавить одну: ${item.name}`}
                    className="w-9 h-9 rounded-lg bg-green-600 active:bg-green-700 hover:bg-green-700 text-white text-xl font-bold leading-none flex items-center justify-center transition-colors"
                    onClick={() => updateQuantity(item.nomenclatureId, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}


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

        {isCreationBlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-700">Для создания листа расхода откройте смену на главном экране.</p>
          </div>
        )}

        <button
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading || isCreationBlocked || !patientName.trim() || (items.length === 0 && !itemsOptional)}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {sheet ? 'Сохранение...' : 'Создание...'}
            </span>
          ) : (
            sheet ? 'Сохранить изменения' : 'Создать лист расхода'
          )}
        </button>
      </div>

      {showNomenclaturePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[calc(var(--vvh,100vh)*0.85)] flex flex-col">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Внесите количество</h3>
            <div className="overflow-y-auto flex-1">
              {nomenclatureLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-slate-500">Загрузка номенклатуры...</p>
                </div>
              ) : nomenclature.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-slate-500 text-center mb-4">Номенклатура не загружена</p>
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    onClick={() => loadNomenclature()}
                  >
                    Повторить загрузку
                  </button>
                </div>
              ) : (
                [...nomenclature].filter(isExpenseCategory).sort((a, b) => {
                  const byGroup = pickerGroup(a) - pickerGroup(b);
                  if (byGroup !== 0) return byGroup;
                  const russianAlphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
                  const getName = (nom: any) => {
                    if (nom.name && typeof nom.name === 'string' && nom.name.length > 0) return nom.name;
                    if (nom.наименование && typeof nom.наименование === 'string') return nom.наименование;
                    if (nom.Наименование && typeof nom.Наименование === 'string') return nom.Наименование;
                    if (nom.productName && typeof nom.productName === 'string') return nom.productName;
                    if (nom.title && typeof nom.title === 'string') return nom.title;
                    for (const [key, value] of Object.entries(nom)) {
                      if (key !== 'id' && key !== 'ID' && key !== 'Id' &&
                          typeof value === 'string' && (value as string).length > 0 && !(value as string).startsWith('NOM-')) {
                        return value as string;
                      }
                    }
                    return '';
                  };

                  const nameA = getName(a).toUpperCase();
                  const nameB = getName(b).toUpperCase();

                  for (let i = 0; i < Math.min(nameA.length, nameB.length); i++) {
                    const charA = nameA[i];
                    const charB = nameB[i];

                    const indexA = russianAlphabet.indexOf(charA);
                    const indexB = russianAlphabet.indexOf(charB);

                    if (indexA !== -1 && indexB !== -1) {
                      if (indexA !== indexB) {
                        return indexA - indexB;
                      }
                    } else if (indexA !== -1) {
                      return -1;
                    } else if (indexB !== -1) {
                      return 1;
                    } else {
                      if (charA !== charB) {
                        return charA < charB ? -1 : 1;
                      }
                    }
                  }

                  return nameA.length - nameB.length;
                }).map((nom, index) => {
                  const nomData = nom as any;

                  let name = '';
                  if (nomData.name && typeof nomData.name === 'string' && nomData.name.length > 0) {
                    name = nomData.name;
                  } else if (nomData.наименование && typeof nomData.наименование === 'string') {
                    name = nomData.наименование;
                  } else if (nomData.Наименование && typeof nomData.Наименование === 'string') {
                    name = nomData.Наименование;
                  } else if (nomData.productName && typeof nomData.productName === 'string') {
                    name = nomData.productName;
                  } else if (nomData.title && typeof nomData.title === 'string') {
                    name = nomData.title;
                  } else {
                    for (const [key, value] of Object.entries(nomData)) {
                      if (key !== 'id' &&
                          key !== 'ID' &&
                          key !== 'Id' &&
                          typeof value === 'string' &&
                          value.length > 0 &&
                          !value.startsWith('NOM-')) {
                        name = value;
                        break;
                      }
                    }
                  }

                  if (!name) {
                    name = `Препарат ${index + 1}`;
                  }

                  // Создаём уникальный ключ на основе имени и индекса
                  const uniqueKey = `${name}_${index}`;

                  // Количество набирается тапом по названию (+1); поле только показывает число,
                  // «−» убирает лишний тап
                  const count = quantities[uniqueKey] || 0;
                  const changeCount = (delta: number) => setQuantities(prev => ({
                    ...prev,
                    [uniqueKey]: Math.max(0, (prev[uniqueKey] || 0) + delta)
                  }));

                  return (
                    <div
                      key={uniqueKey}
                      className={`border-b border-slate-200 flex items-center gap-2 ${count > 0 ? 'bg-blue-50' : ''}`}
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 p-4 text-left select-none active:bg-blue-100 transition-colors"
                        onClick={() => changeCount(1)}
                      >
                        <span className="text-base text-slate-800 font-medium block truncate">{name}</span>
                      </button>
                      {count > 0 && (
                        <button
                          type="button"
                          aria-label={`Убрать одну: ${name}`}
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
                        aria-label={`Количество: ${name}`}
                        className={`w-14 mr-4 shrink-0 border rounded-lg p-2 text-center pointer-events-none select-none ${
                          count > 0 ? 'border-blue-300 bg-white text-blue-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mt-4 transition-colors"
              onClick={() => {
                
                let addedCount = 0;
                
                // Тот же список и порядок, что на экране выбора — иначе количества попадут не к тем позициям
                const sortedNomenclature = [...nomenclature].filter(isExpenseCategory).sort((a, b) => {
                  const byGroup = pickerGroup(a) - pickerGroup(b);
                  if (byGroup !== 0) return byGroup;
                  const russianAlphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
                  const getName = (nom: any) => {
                    if (nom.name && typeof nom.name === 'string' && nom.name.length > 0) return nom.name;
                    if (nom.наименование && typeof nom.наименование === 'string') return nom.наименование;
                    if (nom.Наименование && typeof nom.Наименование === 'string') return nom.Наименование;
                    if (nom.productName && typeof nom.productName === 'string') return nom.productName;
                    if (nom.title && typeof nom.title === 'string') return nom.title;
                    for (const [key, value] of Object.entries(nom)) {
                      if (key !== 'id' && key !== 'ID' && key !== 'Id' &&
                          typeof value === 'string' && (value as string).length > 0 && !(value as string).startsWith('NOM-')) {
                        return value as string;
                      }
                    }
                    return '';
                  };

                  const nameA = getName(a).toUpperCase();
                  const nameB = getName(b).toUpperCase();

                  for (let i = 0; i < Math.min(nameA.length, nameB.length); i++) {
                    const charA = nameA[i];
                    const charB = nameB[i];

                    const indexA = russianAlphabet.indexOf(charA);
                    const indexB = russianAlphabet.indexOf(charB);

                    if (indexA !== -1 && indexB !== -1) {
                      if (indexA !== indexB) {
                        return indexA - indexB;
                      }
                    } else if (indexA !== -1) {
                      return -1;
                    } else if (indexB !== -1) {
                      return 1;
                    } else {
                      if (charA !== charB) {
                        return charA < charB ? -1 : 1;
                      }
                    }
                  }

                  return nameA.length - nameB.length;
                });

                sortedNomenclature.forEach((nom, index) => {
                  const nomData = nom as any;
                  let name = '';
                  if (nomData.name && typeof nomData.name === 'string' && nomData.name.length > 0) {
                    name = nomData.name;
                  } else if (nomData.наименование && typeof nomData.наименование === 'string') {
                    name = nomData.наименование;
                  } else if (nomData.Наименование && typeof nomData.Наименование === 'string') {
                    name = nomData.Наименование;
                  } else if (nomData.productName && typeof nomData.productName === 'string') {
                    name = nomData.productName;
                  } else if (nomData.title && typeof nomData.title === 'string') {
                    name = nomData.title;
                  } else {
                    for (const [key, value] of Object.entries(nomData)) {
                      if (key !== 'id' && key !== 'ID' && key !== 'Id' &&
                          typeof value === 'string' && value.length > 0 && !value.startsWith('NOM-')) {
                        name = value;
                        break;
                      }
                    }
                  }
                  
                  // Создаём уникальный ключ на основе имени и индекса
                  const uniqueKey = `${name}_${index}`;
                  const qty = quantities[uniqueKey] || 0;
                  
                  if (qty > 0) {
                    const price = nomData.currentPrice || nomData.price || nomData.цена || nomData.Цена || 0;
                    
                    addItem({...nom, name, currentPrice: price}, qty, uniqueKey);
                    addedCount++;
                  }
                });
                
                setQuantities({});
                setShowNomenclaturePicker(false);
              }}
            >
              Сохранить и закрыть
            </button>
          </div>
        </div>
      )}    </div>
  );
}
