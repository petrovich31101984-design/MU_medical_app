import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ExpenseItem, Nomenclature } from '../types';

interface ExpenseSheetScreenProps {
  onBack: () => void;
}

export default function ExpenseSheetScreen({ onBack }: ExpenseSheetScreenProps) {
  const { employee } = useAuthStore();
  const { nomenclature, loadNomenclature, createExpenseSheet } = useDataStore();
  
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

  useEffect(() => {
    loadNomenclature();
  }, []);

  const addItem = (nom: Nomenclature) => {
    const existingItem = items.find(i => i.nomenclatureId === nom.id);
    
    if (existingItem) {
      setItems(items.map(i => 
        i.nomenclatureId === nom.id 
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.pricePerUnit }
          : i
      ));
    } else {
      setItems([...items, {
        nomenclatureId: nom.id,
        name: nom.name,
        category: nom.category,
        quantity: 1,
        pricePerUnit: nom.currentPrice,
        total: nom.currentPrice,
      }]);
    }
    
    setShowNomenclaturePicker(false);
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
            + Добавить препарат
          </button>

          {items.map(item => (
            <div key={item.nomenclatureId} className="bg-slate-50 p-4 rounded-lg mb-3 border border-slate-200">
              <div className="flex justify-between items-start mb-3">
                <p className="text-base font-bold text-slate-800 flex-1">{item.name}</p>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-800 hover:bg-slate-300 transition-colors"
                  onClick={() => updateQuantity(item.nomenclatureId, item.quantity - 1)}
                >
                  -
                </button>
                <span className="text-lg font-bold text-slate-800 mx-4 min-w-[30px] text-center">
                  {item.quantity}
                </span>
                <button
                  className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-800 hover:bg-slate-300 transition-colors"
                  onClick={() => updateQuantity(item.nomenclatureId, item.quantity + 1)}
                >
                  +
                </button>
                <span className="text-base font-bold text-green-600 ml-auto">
                  {item.total.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          ))}

          {items.length > 0 && (
            <div className="flex justify-between items-center p-4 bg-slate-100 rounded-lg mt-2">
              <span className="text-lg font-bold text-slate-800">Итого:</span>
              <span className="text-2xl font-bold text-green-600">
                {totalAmount.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
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
              {nomenclature.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Номенклатура не загружена</p>
              ) : (
                nomenclature.map(nom => (
                  <button
                    key={nom.id}
                    className="w-full p-4 border-b border-slate-200 flex justify-between items-center hover:bg-slate-50 transition-colors text-left"
                    onClick={() => addItem(nom)}
                  >
                    <span className="text-base text-slate-800 flex-1">{nom.name}</span>
                    <span className="text-base font-bold text-green-600">
                      {nom.currentPrice.toLocaleString('ru-RU')} ₽
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-4 rounded-lg mt-4 transition-colors"
              onClick={() => setShowNomenclaturePicker(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
