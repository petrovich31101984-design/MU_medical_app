import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ExpenseItem, Nomenclature } from '../types';

interface ExpenseSheetScreenProps {
  onBack: () => void;
}

export default function ExpenseSheetScreen({ onBack }: ExpenseSheetScreenProps) {
  const { employee } = useAuthStore();
  const { nomenclature, loading: nomenclatureLoading, loadNomenclature, createExpenseSheet } = useDataStore();
  
  const [patientName, setPatientName] = useState('');
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [callCategory, setCallCategory] = useState('Первичный');
  const [therapyName, setTherapyName] = useState('');
  const [therapyCost, setTherapyCost] = useState('');
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNomenclaturePicker, setShowNomenclaturePicker] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    console.log('=== EXPENSE SHEET SCREEN MOUNTED ===');
    loadNomenclature();
  }, []);

  const addItem = (nom: Nomenclature, quantity: number = 1) => {
    const nomData = nom as any;
    const name = nomData.name || nomData.наименование || nomData.Наименование || nomData.productName || nomData.title || 'Препарат';
    const price = nomData.currentPrice || nomData.price || nomData.цена || nomData.Цена || 0;
    const category = nomData.category || nomData.категория || nomData.Категория || '';
    
    // Используем nom.id как уникальный идентификатор
    const uniqueId = nom.id;
    
    console.log('Adding item:', { uniqueId, name, price, category, quantity });
    
    setItems(prevItems => {
      const existingItem = prevItems.find(i => i.nomenclatureId === uniqueId);
      
      if (existingItem) {
        // Если позиция уже есть - суммируем количество
        console.log(`Position "${name}" already exists, summing quantities: ${existingItem.quantity} + ${quantity}`);
        return prevItems.map(i => 
          i.nomenclatureId === uniqueId 
            ? { ...i, quantity: i.quantity + quantity, total: (i.quantity + quantity) * i.pricePerUnit }
            : i
        );
      } else {
        // Если позиции нет - добавляем новую
        console.log(`Adding new position "${name}" with quantity ${quantity}`);
        return [...prevItems, {
          nomenclatureId: uniqueId,
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

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (!patientName.trim()) {
      setError('Введите ФИО пациента');
      return;
    }

    if (items.length === 0) {
      setError('Добавьте хотя бы один препарат');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const result = await createExpenseSheet({
        employeeId: employee!.id,
        employeeName: employee!.fullName,
        patientName,
        patientBirthDate,
        date: now.toISOString(),
        month,
        callCategory,
        therapyName,
        therapyCost: parseFloat(therapyCost) || 0,
        items,
        totalAmount,
        archived: false,
      });

      if (result) {
        setSuccess('Лист расхода создан!');
        setTimeout(() => onBack(), 2000);
      } else {
        setError('Не удалось создать лист расхода');
      }
    } catch (err) {
      setError('Произошла ошибка при создании листа расхода');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center">
        <button
          onClick={onBack}
          className="text-blue-600 mr-4 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-lg font-bold text-slate-800">Лист расхода</h1>
      </div>

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
            <label className="text-sm text-slate-500 mb-2 block">Дата рождения</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={patientBirthDate}
              onChange={(e) => setPatientBirthDate(e.target.value)}
              placeholder="ДД.ММ.ГГГГ"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Категория выезда</label>
            <div className="flex gap-2">
              {['Первичный', 'Повторный', 'Курс'].map(cat => (
                <button
                  key={cat}
                  className={`flex-1 py-3 px-4 rounded-lg border text-sm transition-colors ${
                    callCategory === cat
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  onClick={() => setCallCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Название терапии</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={therapyName}
              onChange={(e) => setTherapyName(e.target.value)}
              placeholder="Введите название терапии"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-slate-500 mb-2 block">Стоимость терапии (₽)</label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={therapyCost}
              onChange={(e) => setTherapyCost(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Препараты и расходники</h2>
          
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
                <p className="text-sm text-slate-700 flex-1">{item.name}</p>
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded ml-2">
                  {item.quantity} шт.
                </span>
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

        <button
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Создание...
            </span>
          ) : (
            'Создать лист расхода'
          )}
        </button>
      </div>

      {showNomenclaturePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Выберите препарат</h3>
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
                [...nomenclature].sort((a, b) => {
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

                  if (index === 0) {
                    console.log('=== NOMENCLATURE STRUCTURE ===');
                    console.log('First item:', nomData);
                    console.log('All keys:', Object.keys(nomData));
                  }

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

                  const nomId = nom.id;

                  return (
                    <div
                      key={nomId}
                      className="p-4 border-b border-slate-200 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-base text-slate-800 font-medium block truncate">{name}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={quantities[nomId] || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setQuantities(prev => ({
                            ...prev,
                            [nomId]: value
                          }));
                        }}
                        className="w-20 border border-slate-200 rounded-lg p-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  );
                })
              )}
            </div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mt-4 transition-colors"
              onClick={() => {
                console.log('=== SAVE BUTTON CLICKED ===');
                console.log('Quantities state:', quantities);
                
                let addedCount = 0;
                
                nomenclature.forEach((nom) => {
                  const nomId = nom.id;
                  const qty = quantities[nomId] || 0;
                  
                  if (qty > 0) {
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
                    
                    const price = nomData.currentPrice || nomData.price || nomData.цена || nomData.Цена || 0;
                    
                    console.log(`Adding ${name} with ID: ${nomId}, qty: ${qty}`);
                    addItem({...nom, name, currentPrice: price}, qty);
                    addedCount++;
                  }
                });
                
                console.log(`Total items added: ${addedCount}`);
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
