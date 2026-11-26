/**
 * СМУ - Система Медицинского Учёта
 * Google Apps Script Web App для руководителя + сотрудника
 * Версия 0.5.12
 *  - getEmployees отдаёт список без паролей; getEmployeeWorkState — смена одного сотрудника
 *  - запись в таблицу (doPost) выполняется по одной, через блокировку
 *  - updateReturn: руководитель подтверждает, корректирует или отклоняет возврат
 *  - повторная отправка из офлайн-очереди телефона не создаёт дублей листов расхода, возвратов и сообщений
 *  - правка/удаление уже удалённого сообщения не считается ошибкой (очередь телефона не застревает)
 *  - лист «Прайс услуг»: стоимость услуг по категориям выезда (getServicePrices, setupServicePrices)
 *  - стоимость терапии в листе расхода сотрудника считается по «Прайсу услуг»; сотруднику она не отдаётся
 *  - в прайсе: «Неоплаченная неустойка» и «Неоплаченный медотвод»
 *  - управление прайсом из приложения руководителя: addServicePrice, updateServicePrice, deleteServicePrice
 *  - getServiceList: список актуальных услуг без цен для приложения сотрудника;
 *    стоимость терапии считается по кодам услуг (serviceIds), для старых листов — по названию
 */

// ==================== ГЛАВНЫЕ ФУНКЦИИ ====================

function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'test':
        return jsonResponse({
          success: true,
          title: SpreadsheetApp.getActiveSpreadsheet().getName(),
          sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName())
        });
      case 'getEmployees':
        // Без паролей: список видят приложения руководителя и сотрудников
        return jsonResponse(getPublicEmployeesData());
      case 'getEmployeeWorkState':
        // Смена, блокировка и статус одного сотрудника — для приложения сотрудника
        return jsonResponse(getEmployeeWorkStateData(e.parameter.employeeId));
      case 'getNomenclature':
        return jsonResponse(getNomenclatureData());
      case 'getPrices':
        return jsonResponse(getPricesData());
      case 'getServicePrices':
        return jsonResponse(getServicePricesData());
      case 'getServiceList':
        // Для приложения сотрудника: только актуальные услуги, без цен
        return jsonResponse(getServiceListData());
      case 'getArrivals':
        return jsonResponse(getArrivalsData());
      case 'getInitialStock':
        return jsonResponse(getInitialStockData(e.parameter.employeeId));
      case 'getExpenses':
        return jsonResponse(getExpensesData());
      case 'getExpenseSheets':
        return jsonResponse(getExpenseSheetsData());
      case 'getReturns':
        return jsonResponse(getReturnsData());
      case 'getChat':
        return jsonResponse(getChatData());
      case 'getAuditLog':
        return jsonResponse(getAuditLogData());
      case 'getAnnouncements':
        return jsonResponse(getAnnouncementsData());
      case 'authenticateEmployee':
        return jsonResponse(authenticateEmployee(e.parameter.personalNumber, e.parameter.password));
      case 'getEmployeeExpenseSheets':
        return jsonResponse(getEmployeeExpenseSheetsData(e.parameter.employeeId));
      case 'getEmployeeMessages':
        return jsonResponse(getEmployeeMessagesData(e.parameter.employeeId));
      default:
        return jsonResponse({ error: 'Неизвестное действие: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

// Записи выполняются по одной: иначе при одновременном сохранении
// строки могли сдвинуться и изменение попадало не в ту строку
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonResponse({ error: 'Сервер занят, попробуйте ещё раз' });
  try {
    return handlePost(e);
  } finally {
    lock.releaseLock();
  }
}

function handlePost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data;

    switch (action) {
      // Сотрудники
      case 'addEmployee':
        addEmployeeData(data);
        return jsonResponse({ success: true });
      case 'updateEmployee':
        updateEmployeeData(data.id, data.data);
        return jsonResponse({ success: true });
      case 'updateEmployeeShift':
        updateEmployeeShiftData(data.id, data.shiftOpen);
        return jsonResponse({ success: true });
      case 'deleteEmployee':
        deleteEmployeeData(data.id);
        return jsonResponse({ success: true });

      // Номенклатура
      case 'addNomenclature':
        addNomenclatureData(data);
        return jsonResponse({ success: true });
      case 'updateNomenclature':
        updateNomenclatureData(data.id, data);
        return jsonResponse({ success: true });
      case 'deleteNomenclature':
        deleteNomenclatureData(data.id);
        return jsonResponse({ success: true });

      // Прайс услуг
      case 'addServicePrice':
        addServicePriceData(data);
        return jsonResponse({ success: true });
      case 'updateServicePrice':
        updateServicePriceData(data.id, data.data);
        return jsonResponse({ success: true });
      case 'deleteServicePrice':
        deleteRow(SERVICE_PRICES_SHEET, data.id);
        return jsonResponse({ success: true });

      // Начальные остатки
      case 'addInitialStock':
        addInitialStockData(data);
        return jsonResponse({ success: true });
      case 'migrateInitialStock':
        return jsonResponse({ success: true, migrated: migrateInitialStockData(data.employeeId) });

      // Приход
      case 'addArrival':
        addArrivalData(data);
        return jsonResponse({ success: true });
      case 'updateArrival':
        updateArrivalData(data.id, data.data);
        return jsonResponse({ success: true });
      case 'deleteArrival':
        deleteArrivalData(data.id);
        return jsonResponse({ success: true });
      case 'archiveArrival':
        archiveArrivalData(data.id);
        return jsonResponse({ success: true });
      case 'restoreArrival':
        restoreArrivalData(data.id);
        return jsonResponse({ success: true });

      // Расход
      case 'addExpense':
        addExpenseData(data);
        return jsonResponse({ success: true });

      // Листы расхода
      case 'addExpenseSheet':
        addExpenseSheetData(data);
        return jsonResponse({ success: true });
      case 'updateExpenseSheet':
        updateExpenseSheetData(data.id, data.data);
        return jsonResponse({ success: true });
      case 'archiveExpenseSheet':
        archiveExpenseSheetData(data.id);
        return jsonResponse({ success: true });
      case 'restoreExpenseSheet':
        restoreExpenseSheetData(data.id);
        return jsonResponse({ success: true });

      // Возвраты
      case 'addReturn':
        addReturnData(data);
        return jsonResponse({ success: true });
      case 'updateReturn':
        // Подтверждение / корректировка / отклонение возврата руководителем
        updateRow('Возвраты', data.id, data.data);
        return jsonResponse({ success: true });

      // Чат
      case 'addChatMessage':
        addChatMessageData(data);
        return jsonResponse({ success: true });
      // Сообщение могли уже удалить (или это повтор из офлайн-очереди телефона) —
      // «не найдено» не ошибка, иначе очередь на телефоне застрянет на этой записи
      case 'updateChatMessage': {
        const { id, ...updates } = data;
        ignoreNotFound(() => updateChatMessageData(id, updates));
        return jsonResponse({ success: true });
      }
      case 'editChatMessage':
        ignoreNotFound(() => updateChatMessageData(data.id, { 'Текст': data.text }));
        return jsonResponse({ success: true });
      case 'deleteChatMessage':
        ignoreNotFound(() => deleteChatMessageData(data.id));
        return jsonResponse({ success: true });

      // Объявления
      case 'createAnnouncement':
        createAnnouncementData(data);
        return jsonResponse({ success: true });
      case 'updateAnnouncement':
        updateAnnouncementData(data['ID'], data);
        return jsonResponse({ success: true });
      case 'deleteAnnouncement':
        deleteAnnouncementData(data['ID']);
        return jsonResponse({ success: true });

      // Журнал изменений
      case 'addAuditLog':
        addAuditLogData(data);
        return jsonResponse({ success: true });
      case 'clearAuditLog':
        clearAuditLogData();
        return jsonResponse({ success: true });

      default:
        return jsonResponse({ error: 'Неизвестное действие: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Выполнить действие; ошибку «Запись с ID … не найдена» пропустить
function ignoreNotFound(action) {
  try {
    action();
  } catch (error) {
    if (String(error).indexOf('не найдена') === -1) throw error;
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  return data.slice(1).filter(row => row[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'Месяц') {
        if (val instanceof Date) {
          const year = val.getFullYear();
          const month = String(val.getMonth() + 1).padStart(2, '0');
          obj[h] = `${year}-${month}`;
        } else {
          obj[h] = val || '';
        }
      } else if (val instanceof Date) {
        obj[h] = val.toISOString();
      } else {
        obj[h] = val || '';
      }
    });
    return obj;
  });
}

// Листы, куда пишет офлайн-очередь телефона сотрудника. При слабой связи запись могла дойти
// до таблицы, а ответ — потеряться; телефон отправит её ещё раз с тем же ID. Вторую копию не добавляем.
const DEDUP_SHEETS = ['Листы расхода', 'Возвраты', 'Чат'];

function appendRow(sheetName, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Лист не найден: ' + sheetName);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newId = String(rowData['ID'] ?? '').trim();
  const idColumn = headers.indexOf('ID');
  if (newId && idColumn !== -1 && DEDUP_SHEETS.indexOf(sheetName) !== -1 && sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).getValues();
    if (ids.some(r => String(r[0]).trim() === newId)) return; // уже записано — это повтор
  }
  const row = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
  const targetRow = sheet.getLastRow() + 1;
  row.forEach((value, colIndex) => {
    if (typeof value === 'string' && /^0\d+$/.test(value)) {
      sheet.getRange(targetRow, colIndex + 1).setNumberFormat('@');
    }
  });
  sheet.appendRow(row);
}

function updateRow(sheetName, id, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Лист не найден: ' + sheetName);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumn = headers.indexOf('ID');

  if (idColumn === -1) {
    throw new Error('Столбец "ID" не найден в листе "' + sheetName + '"');
  }

  const searchId = String(id).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumn]).trim() === searchId) {
      Object.keys(updates).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          const value = updates[key];
          if (typeof value === 'string' && /^0\d+$/.test(value)) {
            sheet.getRange(i + 1, colIndex + 1).setNumberFormat('@');
          }
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      });
      return;
    }
  }

  throw new Error('Запись с ID ' + id + ' не найдена');
}

function deleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Лист не найден: ' + sheetName);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumn = headers.indexOf('ID');

  if (idColumn === -1) {
    throw new Error('Столбец "ID" не найден в листе "' + sheetName + '"');
  }

  const searchId = String(id).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumn]).trim() === searchId) {
      sheet.deleteRow(i + 1);
      return { success: true, deletedId: id };
    }
  }

  throw new Error('Запись с ID ' + id + ' не найдена');
}

// ==================== СОТРУДНИКИ ====================

function getEmployeesData() {
  // Полные строки, вместе с паролями — только для проверки входа внутри скрипта
  return readSheetData('Сотрудники');
}

// Колонки, которые никогда не отдаются наружу
var EMPLOYEE_SECRET_COLUMNS = ['Пароль', 'Пароль (хэш)'];

function getPublicEmployeesData() {
  return getEmployeesData().map(function (row) {
    var copy = {};
    Object.keys(row).forEach(function (key) {
      if (EMPLOYEE_SECRET_COLUMNS.indexOf(key) === -1) copy[key] = row[key];
    });
    return copy;
  });
}

function getEmployeeWorkStateData(employeeId) {
  var searchId = String(employeeId || '').trim();
  if (!searchId) return { success: false, error: 'Не указан сотрудник' };
  var employee = getEmployeesData().find(function (row) {
    return String(row['ID']).trim() === searchId;
  });
  if (!employee) return { success: false, error: 'Сотрудник не найден' };
  return {
    success: true,
    shiftOpen: employee['Смена открыта'] === 'ДА' || employee['Смена открыта'] === true,
    blocked: employee['Заблокирован'] === 'ДА' || employee['Заблокирован'] === true,
    status: String(employee['Статус'] || '').trim()
  };
}

function addEmployeeData(data) {
  appendRow('Сотрудники', data);
}

function updateEmployeeData(id, updates) {
  updateRow('Сотрудники', id, updates);
}

function updateEmployeeShiftData(id, shiftOpen) {
  // Открытие смены делает сотрудника «Активен», закрытие — «Неактивен»
  // (как в скриптах приложения руководителя)
  updateRow('Сотрудники', id, {
    'Смена открыта': shiftOpen ? 'ДА' : 'НЕТ',
    'Статус': shiftOpen ? 'Активен' : 'Неактивен'
  });
}

function deleteEmployeeData(id) {
  deleteRow('Сотрудники', id);
}

// ==================== НОМЕНКЛАТУРА ====================

function getNomenclatureData() {
  return readSheetData('Номенклатура');
}

function addNomenclatureData(data) {
  const nomenclatureId = data['ID'] || data.id || 'NOM-' + Date.now();
  const name = data['Название'] ?? data.name ?? '';
  const now = new Date();
  appendRow('Номенклатура', {
    'ID': nomenclatureId,
    'Название': name,
    'Категория': data['Категория'] ?? data.category ?? '',
    'Ед. измерения': data['Ед. измерения'] ?? data.unit ?? '',
    'Производитель': data['Производитель'] ?? data.manufacturer ?? '',
    'Количество в упаковке': data['Количество в упаковке'] ?? data.packageQuantity ?? 1,
    'Актуальна': data['Актуальна'] ?? (data.active === false ? 'НЕТ' : 'ДА'),
    'Дата создания': now,
    'Примечание': data['Примечание'] ?? data.note ?? ''
  });
  const price = data['Цена за ед. (₽)'] ?? data.currentPrice;
  if (price !== undefined) {
    appendRow('Цены', {
      'ID': 'PRICE-' + Date.now(),
      'Номенклатура_ID': nomenclatureId,
      'Название': name,
      'Цена за ед. (₽)': price,
      'Дата начала': now,
      'Дата окончания': '',
      'Кем изменено': data['Кем изменено'] ?? 'Руководитель',
      'Дата изменения': now,
      'Примечание': 'Цена при добавлении номенклатуры'
    });
  }
}

function updateNomenclatureData(id, updates) {
  const name = updates['Название'] ?? updates.name ?? '';
  updateRow('Номенклатура', id, {
    'Название': name,
    'Категория': updates['Категория'] ?? updates.category ?? '',
    'Ед. измерения': updates['Ед. измерения'] ?? updates.unit ?? '',
    'Производитель': updates['Производитель'] ?? updates.manufacturer ?? '',
    'Количество в упаковке': updates['Количество в упаковке'] ?? updates.packageQuantity ?? 1,
    'Актуальна': updates['Актуальна'] ?? (updates.active === false ? 'НЕТ' : 'ДА')
  });
  const price = updates['Цена за ед. (₽)'] ?? updates.currentPrice;
  if (price === undefined) return;
  const activePrices = getPricesData().filter(row =>
    String(row['Номенклатура_ID'] ?? '').trim() === String(id).trim() &&
    !row['Дата окончания']
  );
  const currentPrice = activePrices[activePrices.length - 1];
  if (currentPrice && Number(currentPrice['Цена за ед. (₽)']) === Number(price)) return;
  const now = new Date();
  activePrices.forEach(row => {
    updateRow('Цены', row['ID'], { 'Дата окончания': now });
  });
  appendRow('Цены', {
    'ID': 'PRICE-' + Date.now(),
    'Номенклатура_ID': id,
    'Название': name,
    'Цена за ед. (₽)': price,
    'Дата начала': now,
    'Дата окончания': '',
    'Кем изменено': updates['Кем изменено'] ?? 'Руководитель',
    'Дата изменения': now,
    'Примечание': 'Изменение цены номенклатуры'
  });
}

function deleteNomenclatureData(id) {
  deleteRow('Номенклатура', id);
}

// ==================== ЦЕНЫ ====================

function getPricesData() {
  return readSheetData('Цены');
}

// ==================== ПРАЙС УСЛУГ ====================

const SERVICE_PRICES_SHEET = 'Прайс услуг';
const SERVICE_PRICES_HEADERS = ['ID', 'Категория выезда', 'Название услуги', 'Стоимость (₽)', 'Актуальна', 'Дата изменения', 'Примечание'];

// Услуги, которые сейчас можно выбрать в листе расхода приложения сотрудника.
// «Вызов» — для категорий «Вызов однократно» и «Вызов + повторы».
const DEFAULT_SERVICES = [
  ['Вызов', 'Обычное очищение'],
  ['Вызов', 'Двойное очищение'],
  ['Вызов', 'Глубокое очищение'],
  ['Вызов', '3 Detox'],
  ['Вызов', '4 Detox'],
  ['Вызов', '5 Detox'],
  ['Вызов', 'Smart Detox'],
  ['Курс', 'Восстановление стандарт'],
  ['Курс', 'Восстановление стандарт +'],
  ['Курс', 'Восстановление максимум'],
  ['Курс', 'Восстановление + кардио'],
  ['Курс', 'Восстановление + нейрооптимизация (NO терапия)'],
  ['Курс', 'Нейро Рестарт'],
  ['Курс', 'Красота и молодость'],
  ['Курс', 'Терапия IQ - 1'],
  ['Курс', 'Терапия IQ - 2'],
  ['Курс', 'Повышение иммунитета-1'],
  ['Курс', 'Повышение иммунитета - 2'],
  ['Госпитализация', 'Ближняя госпитализация'],
  ['Госпитализация', 'Дальняя госпитализация'],
  ['Госпитализация', 'ГПС'],
  ['Госпитализация', 'Другая госпитализация'],
  ['Мед. отвод', 'Мед. отвод'],
  ['Мед. отвод', 'Неоплаченный медотвод'],
  ['Неустойка', 'Неустойка'],
  ['Неустойка', 'Неоплаченная неустойка']
];

function getServicePricesData() {
  return readSheetData(SERVICE_PRICES_SHEET);
}

// Создаёт лист «Прайс услуг» (если его нет) и дописывает услуги, которых в нём ещё нет.
// Уже внесённые цены не трогает — запускать можно повторно. Стоимость заполняется вручную.
function setupServicePrices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SERVICE_PRICES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SERVICE_PRICES_SHEET);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SERVICE_PRICES_HEADERS.length).setValues([SERVICE_PRICES_HEADERS]);
  }
  sheet.getRange(1, 1, 1, SERVICE_PRICES_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  const existing = {};
  getServicePricesData().forEach(row => {
    existing[String(row['Категория выезда']).trim() + '|' + String(row['Название услуги']).trim()] = true;
  });

  const now = new Date();
  const base = Date.now();
  const newRows = DEFAULT_SERVICES
    .filter(s => !existing[s[0] + '|' + s[1]])
    .map((s, i) => ['SRV-' + (base + i), s[0], s[1], '', 'ДА', now, '']);

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, SERVICE_PRICES_HEADERS.length).setValues(newRows);
  }
  sheet.getRange(2, 4, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat('#,##0.00 ₽');
  sheet.autoResizeColumns(1, SERVICE_PRICES_HEADERS.length);
  Logger.log('Лист «' + SERVICE_PRICES_SHEET + '»: добавлено услуг — ' + newRows.length);
  return newRows.length;
}

// Изменения прайса из приложения руководителя
function addServicePriceData(data) {
  // Листа ещё нет — создаём его вместе с услугами по умолчанию
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SERVICE_PRICES_SHEET)) setupServicePrices();
  appendRow(SERVICE_PRICES_SHEET, {
    'ID': data['ID'] || data.id || 'SRV-' + Date.now(),
    'Категория выезда': data['Категория выезда'] ?? data.category ?? '',
    'Название услуги': data['Название услуги'] ?? data.name ?? '',
    'Стоимость (₽)': data['Стоимость (₽)'] ?? data.price ?? '',
    'Актуальна': data['Актуальна'] ?? (data.active === false ? 'НЕТ' : 'ДА'),
    'Дата изменения': new Date(),
    'Примечание': data['Примечание'] ?? data.note ?? ''
  });
}

function updateServicePriceData(id, updates) {
  const row = {};
  if (updates.category !== undefined) row['Категория выезда'] = updates.category;
  if (updates.name !== undefined) row['Название услуги'] = updates.name;
  if (updates.price !== undefined) row['Стоимость (₽)'] = updates.price;
  if (updates.active !== undefined) row['Актуальна'] = updates.active === false ? 'НЕТ' : 'ДА';
  if (updates.note !== undefined) row['Примечание'] = updates.note;
  row['Дата изменения'] = new Date();
  updateRow(SERVICE_PRICES_SHEET, id, row);
}

// Категория выезда в листе расхода → категория в прайсе
function servicePriceCategory(callCategory) {
  const category = String(callCategory || '').trim();
  if (category === 'Вызов однократно' || category === 'Вызов + повторы') return 'Вызов';
  return category;
}

// Стоимость терапии по прайсу: сумма цен выбранных услуг («Вызов + повторы» — несколько через запятую).
// Если услуга не выбрана (старые листы «Мед. отвод» и «Неустойка»), берём строку с названием категории.
// Коды услуг (serviceIds) приходят из приложения сотрудника и надёжнее названий:
// услугу могли переименовать, пока телефон был без сети. Если кода нет — ищем по названию.
function calcTherapyCost(callCategory, therapyName, serviceIds) {
  const category = servicePriceCategory(callCategory);
  if (!category) return 0;

  const activeRows = getServicePricesData().filter(row =>
    String(row['Актуальна']).trim().toUpperCase() !== 'НЕТ'
  );
  const priceOf = row => Number(row['Стоимость (₽)']) || 0;

  const ids = (Array.isArray(serviceIds) ? serviceIds : String(serviceIds || '').split(','))
    .map(id => String(id).trim()).filter(Boolean);
  if (ids.length > 0) {
    const byId = {};
    activeRows.forEach(row => { byId[String(row['ID']).trim()] = priceOf(row); });
    if (ids.every(id => byId[id] !== undefined)) {
      return ids.reduce((sum, id) => sum + byId[id], 0);
    }
  }

  let names = String(therapyName || '').split(', ').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) names = [category];
  const byName = {};
  activeRows.forEach(row => {
    if (String(row['Категория выезда']).trim() !== category) return;
    byName[String(row['Название услуги']).trim()] = priceOf(row);
  });
  return names.reduce((sum, name) => sum + (byName[name] || 0), 0);
}

function getServiceListData() {
  return getServicePricesData()
    .filter(row => String(row['Актуальна']).trim().toUpperCase() !== 'НЕТ')
    .filter(row => String(row['Название услуги']).trim() !== '')
    .map(row => ({
      id: String(row['ID']).trim(),
      category: String(row['Категория выезда']).trim(),
      name: String(row['Название услуги']).trim()
    }));
}

// ==================== НАЧАЛЬНЫЕ ОСТАТКИ ====================

function getInitialStockData(employeeId) {
  const rows = readSheetData('Начальные остатки');
  if (!employeeId) return rows;

  const searchId = String(employeeId).trim();
  return rows.filter(row => String(row['Сотрудник_ID'] ?? '').trim() === searchId);
}

function addInitialStockData(data) {
  const positionsValue = data.items ?? data['Позиции'] ?? data['Позиции (JSON)'];
  const positions = typeof positionsValue === 'string'
    ? JSON.parse(positionsValue || '[]')
    : positionsValue || [];
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error('Не переданы позиции начальных остатков');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Начальные остатки');
  if (!sheet) throw new Error('Лист не найден: Начальные остатки');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const employeeId = String(data['Сотрудник_ID'] ?? data.employeeId ?? '').trim();
  const employeeName = data['ФИО'] ?? data['ФИО сотрудника'] ?? data.employeeName ?? '';
  const employeeIdColumn = headers.indexOf('Сотрудник_ID');
  if (employeeIdColumn === -1) throw new Error('Столбец "Сотрудник_ID" не найден');

  const existingRows = sheet.getDataRange().getValues();
  for (let i = existingRows.length - 1; i >= 1; i--) {
    if (String(existingRows[i][employeeIdColumn]).trim() === employeeId) {
      sheet.deleteRow(i + 1);
    }
  }

  const baseId = data['ID'] || data.id || 'INITIAL-' + employeeId;
  const rows = positions.map((item, index) => {
    const nomenclatureId = item.nomenclatureId ?? item['Номенклатура_ID'] ?? item.id ?? '';
    const rowData = {
      'ID': baseId + '-' + (nomenclatureId || index + 1),
      'Сотрудник_ID': employeeId,
      'ФИО': employeeName,
      'Номенклатура_ID': nomenclatureId,
      'Название': item.name ?? item['Название'] ?? '',
      'Количество': item.quantity ?? item['Количество'] ?? 0,
      'Ед. изм.': item.unit ?? item['Ед. изм.'] ?? '',
      'Дата': data['Дата'] ?? data.date ?? new Date(),
      'Кем внесено': data['Кем внесено'] ?? employeeName,
      'Период': data['Период'] ?? data['Месяц'] ?? data.month ?? '',
      'Примечание': data['Примечание'] ?? data['Комментарий'] ?? ''
    };
    return headers.map(header => rowData[header] !== undefined ? rowData[header] : '');
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function migrateInitialStockData(employeeId) {
  const searchId = String(employeeId || '').trim();
  if (!searchId) throw new Error('Не указан сотрудник');
  const hasValidRows = getInitialStockData(searchId)
    .some(row => String(row['Номенклатура_ID'] ?? '').trim() !== '');
  if (hasValidRows) return 0;

  const legacyRows = getArrivalsData().filter(row =>
    String(row['Сотрудник_ID'] ?? '').trim() === searchId &&
    String(row['Тип'] ?? '').trim().toLowerCase() === 'начальные остатки'
  );

  legacyRows.forEach(row => {
    addInitialStockData(row);
    deleteRow('Приход', row['ID']);
  });

  return legacyRows.length;
}

// ==================== ПРИХОД ====================

function getArrivalsData() {
  return readSheetData('Приход');
}

function normalizeArrivalData(data) {
  const normalized = { ...data };
  const fieldMap = {
    id: 'ID',
    employeeId: 'Сотрудник_ID',
    employeeName: 'ФИО сотрудника',
    date: 'Дата',
    month: 'Месяц',
    amount: 'Сумма (₽)',
    shifts: 'Количество смен',
    addedBy: 'Кем внесено',
    type: 'Тип',
    comment: 'Комментарий'
  };
  Object.keys(fieldMap).forEach(key => {
    if (data[key] !== undefined) normalized[fieldMap[key]] = data[key];
  });
  if (data.employeeName !== undefined) normalized['Сотрудник'] = data.employeeName;
  if (data.archived !== undefined) normalized['Архив'] = data.archived ? 'ДА' : 'НЕТ';
  const positions = data.items ?? data['Позиции'] ?? data['Позиции (JSON)'];
  if (positions !== undefined) {
    const serializedPositions = typeof positions === 'string' ? positions : JSON.stringify(positions);
    normalized['Позиции'] = serializedPositions;
    normalized['Позиции (JSON)'] = serializedPositions;
  }
  return normalized;
}

function addArrivalData(data) {
  const rowData = normalizeArrivalData(data);
  rowData['ID'] = rowData['ID'] || 'ARR-' + Date.now();
  rowData['Дата внесения'] = rowData['Дата внесения'] || new Date();
  rowData['Архив'] = rowData['Архив'] || 'НЕТ';
  appendRow('Приход', rowData);
}

function updateArrivalData(id, updates) {
  updateRow('Приход', id, normalizeArrivalData(updates));
}

function deleteArrivalData(id) {
  deleteRow('Приход', id);
}

function archiveArrivalData(id) {
  updateRow('Приход', id, { 'Архив': 'ДА' });
}

function restoreArrivalData(id) {
  updateRow('Приход', id, { 'Архив': 'НЕТ' });
}

// ==================== РАСХОД ====================

function getExpensesData() {
  return readSheetData('Расход');
}

function addExpenseData(data) {
  appendRow('Расход', data);
}

// ==================== ЛИСТЫ РАСХОДА ====================

function getExpenseSheetsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Листы расхода');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  return data.slice(1).filter(row => row[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'items' || h === 'Позиции' || h === 'Позиции (JSON)') {
        if (typeof val === 'string' && val) {
          try {
            obj[h] = JSON.parse(val);
          } catch (e) {
            obj[h] = [];
          }
        } else {
          obj[h] = [];
        }
      } else if (h === 'Месяц') {
        if (val instanceof Date) {
          const year = val.getFullYear();
          const month = String(val.getMonth() + 1).padStart(2, '0');
          obj[h] = `${year}-${month}`;
        } else {
          obj[h] = val || '';
        }
      } else if (val instanceof Date) {
        obj[h] = val.toISOString();
      } else {
        obj[h] = val || '';
      }
    });
    return obj;
  });
}

function addExpenseSheetData(data) {
  const positions = data.items ?? data['Позиции'] ?? data['Позиции (JSON)'];
  const serializedPositions = typeof positions === 'string'
    ? positions
    : JSON.stringify(positions || []);

  const callCategory = data['Категория выезда'] ?? data.callCategory ?? '';
  const therapyName = data['Название терапии'] ?? data.therapyName ?? '';
  // Приложение сотрудника стоимость не передаёт — берём из прайса
  const therapyCost = data['Стоимость терапии'] ?? data.therapyCost ?? calcTherapyCost(callCategory, therapyName, data.serviceIds);

  appendRow('Листы расхода', {
    'ID': data['ID'] || data.id || 'SHEET-' + Date.now(),
    'Сотрудник_ID': data['Сотрудник_ID'] ?? data.employeeId ?? '',
    'Сотрудник': data['Сотрудник'] ?? data.employeeName ?? '',
    'Пациент': data['Пациент'] ?? data.patientName ?? '',
    'Дата рождения пациента': data['Дата рождения пациента'] ?? data.patientBirthDate ?? '',
    'Дата': data['Дата'] ?? data.date ?? '',
    'Месяц': data['Месяц'] ?? data.month ?? '',
    'Категория выезда': callCategory,
    'Название терапии': therapyName,
    'Стоимость терапии': therapyCost,
    'Итого по препаратам': data['Итого по препаратам'] ?? data.totalAmount ?? 0,
    'Позиции': serializedPositions,
    'Позиции (JSON)': serializedPositions,
    'Архив': data['Архив'] ?? (data.archived ? 'ДА' : 'НЕТ'),
    'Дата создания': data['Дата создания'] ?? new Date()
  });
}

function updateExpenseSheetData(id, updates) {
  const positions = updates.items ?? updates['Позиции'] ?? updates['Позиции (JSON)'];
  if (positions !== undefined) {
    const serializedPositions = typeof positions === 'string'
      ? positions
      : JSON.stringify(positions);
    updates['Позиции'] = serializedPositions;
    updates['Позиции (JSON)'] = serializedPositions;
  }
  // Сотрудник сменил категорию или терапию, а стоимость не передал — пересчитываем по прайсу
  const serviceIds = updates.serviceIds;
  delete updates.serviceIds;
  if (updates['Стоимость терапии'] === undefined &&
      (updates['Категория выезда'] !== undefined || updates['Название терапии'] !== undefined)) {
    const current = readSheetData('Листы расхода').find(row => String(row['ID']).trim() === String(id).trim()) || {};
    updates['Стоимость терапии'] = calcTherapyCost(
      updates['Категория выезда'] ?? current['Категория выезда'],
      updates['Название терапии'] ?? current['Название терапии'],
      serviceIds
    );
  }
  updateRow('Листы расхода', id, updates);
}

function archiveExpenseSheetData(id) {
  updateRow('Листы расхода', id, { 'Архив': 'ДА' });
}

function restoreExpenseSheetData(id) {
  updateRow('Листы расхода', id, { 'Архив': 'НЕТ' });
}

// ==================== ВОЗВРАТЫ ====================

function getReturnsData() {
  return readSheetData('Возвраты');
}

function addReturnData(data) {
  const dateValue = data['Дата создания'] || data.createdAt || data.date || new Date();
  const createdAt = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const month = data['Месяц'] || data.month || createdAt.getFullYear() + '-' + String(createdAt.getMonth() + 1).padStart(2, '0');
  const unit = data['Ед. измерения'] ?? data['Ед. изм.'] ?? data.unit ?? '';

  appendRow('Возвраты', {
    'ID': data['ID'] || data.id || 'RETURN-' + Date.now(),
    'Сотрудник_ID': data['Сотрудник_ID'] ?? data.employeeId ?? '',
    'ФИО сотрудника': data['ФИО сотрудника'] ?? data.employeeName ?? data['Сотрудник'] ?? '',
    'Дата создания': createdAt,
    'Месяц': month,
    'Номенклатура_ID': data['Номенклатура_ID'] ?? data.nomenclatureId ?? '',
    'Название': data['Название'] ?? data.nomenclatureName ?? data.name ?? '',
    'Ед. измерения': unit,
    'Ед. изм.': unit,
    'Количество': data['Количество'] ?? data.quantity ?? 0,
    'Статус': data['Статус'] ?? data.status ?? 'Ожидает подтверждения',
    'Кем скорректировано': data['Кем скорректировано'] ?? data.correctedBy ?? '',
    'Скорректированное кол-во': data['Скорректированное кол-во'] ?? data.correctedQuantity ?? '',
    'Комментарий': data['Комментарий'] ?? data.comment ?? '',
    'Причина': data['Причина'] ?? data.reason ?? ''
  });
}

// ==================== ЧАТ ====================

function getChatData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Чат');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  return data.slice(1).map((row, index) => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'ID' && (val === '' || val === null || val === undefined)) {
        obj[h] = 'MSG-AUTO-' + (index + 1) + '-' + Date.now();
      } else if (val instanceof Date) {
        obj[h] = val.toISOString();
      } else {
        obj[h] = val || '';
      }
    });
    return obj;
  });
}

function addChatMessageData(data) {
  appendRow('Чат', {
    'ID': data['ID'] || data.id || 'MSG-' + Date.now(),
    'От кого (ID)': data['От кого (ID)'] ?? data.fromId ?? '',
    'От кого (ФИО)': data['От кого (ФИО)'] ?? data.fromName ?? '',
    'Кому (ID)': data['Кому (ID)'] ?? data.toId ?? '',
    'Кому (ФИО)': data['Кому (ФИО)'] ?? data.toName ?? '',
    'Роль': data['Роль'] ?? data.role ?? 'Сотрудник',
    'Текст': data['Текст'] ?? data.text ?? '',
    'Дата и время': data['Дата и время'] ?? data.date ?? new Date(),
    'Прочитано': data['Прочитано'] ?? data.read ?? false,
    'Тип': data['Тип'] ?? data.type ?? '',
    'Приоритет': data['Приоритет'] ?? data.priority ?? 'Обычное'
  });
}

function updateChatMessageData(id, updates) {
  updateRow('Чат', id, updates);
}

function deleteChatMessageData(id) {
  deleteRow('Чат', id);
}

// ==================== ОБЪЯВЛЕНИЯ ====================

function getAnnouncementsData() {
  return readSheetData('Объявления');
}

function createAnnouncementData(data) {
  appendRow('Объявления', data);
}

function updateAnnouncementData(id, updates) {
  updateRow('Объявления', id, updates);
}

function deleteAnnouncementData(id) {
  return deleteRow('Объявления', id);
}

// ==================== ЖУРНАЛ ИЗМЕНЕНИЙ ====================

function getAuditLogData() {
  return readSheetData('Журнал изменений');
}

function addAuditLogData(data) {
  appendRow('Журнал изменений', data);
}

function clearAuditLogData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Журнал изменений');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

// ==================== АВТОРИЗАЦИЯ СОТРУДНИКА ====================

function authenticateEmployee(personalNumber, password) {
  if (!personalNumber || !password) {
    return { success: false, error: 'Не указан персональный номер или пароль' };
  }

  const employees = getEmployeesData();
  const employee = employees.find(item =>
    String(item['Персональный номер']).trim() === String(personalNumber).trim()
  );

  if (!employee) {
    return { success: false, error: 'Сотрудник не найден' };
  }

  const storedPassword = String(employee['Пароль'] ?? employee['Пароль (хэш)'] ?? '').trim();
  const inputPassword = String(password).trim();
  const passwordsMatch =
    storedPassword === inputPassword ||
    (
      storedPassword !== '' &&
      inputPassword !== '' &&
      Number(storedPassword) === Number(inputPassword)
    );

  if (!passwordsMatch) {
    return { success: false, error: 'Неверный пароль' };
  }

  if (employee['Заблокирован'] === 'ДА' || employee['Заблокирован'] === true) {
    return { success: false, error: 'Аккаунт заблокирован' };
  }

  if (employee['Статус'] === 'Уволен') {
    return { success: false, error: 'Аккаунт уволен' };
  }

  return {
    success: true,
    id: employee['ID'],
    personalNumber: employee['Персональный номер'],
    fullName: employee['ФИО'],
    status: employee['Статус'] || 'Активен',
    position: employee['Должность'] || '',
    hireDate: employee['Дата найма'] || '',
    blocked: employee['Заблокирован'] === 'ДА' || employee['Заблокирован'] === true,
    phone: employee['Телефон'] || '',
    lastActivity: employee['Последний вход'] || '',
    note: employee['Примечание'] || '',
    shiftOpen: employee['Смена открыта'] === 'ДА' || employee['Смена открыта'] === true
  };
}

// ==================== ДАННЫЕ СОТРУДНИКА ====================

function getEmployeeExpenseSheetsData(employeeId) {
  return getExpenseSheetsData()
    .filter(sheet => String(sheet['Сотрудник_ID']).trim() === String(employeeId).trim())
    .map(sheet => {
      // Стоимость терапии сотруднику не показываем
      delete sheet['Стоимость терапии'];
      return sheet;
    })
    .map(sheet => ({
      ...sheet,
      id: sheet['ID'],
      employeeId: sheet['Сотрудник_ID'],
      employeeName: sheet['Сотрудник'],
      patientName: sheet['Пациент'],
      patientBirthDate: sheet['Дата рождения пациента'],
      date: sheet['Дата'],
      month: sheet['Месяц'],
      callCategory: sheet['Категория выезда'],
      therapyName: sheet['Название терапии'],
      totalAmount: sheet['Итого по препаратам'],
      items: sheet['Позиции'] ?? sheet['Позиции (JSON)'] ?? [],
      archived: sheet['Архив'] === 'ДА' || sheet['Архив'] === true
    }));
}

function getEmployeeMessagesData(employeeId) {
  const searchId = String(employeeId).trim();

  return getChatData()
    .filter(message =>
      String(message['От кого (ID)']).trim() === searchId ||
      String(message['Кому (ID)']).trim() === searchId
    )
    .map(message => ({
      id: message['ID'],
      fromId: message['От кого (ID)'],
      fromName: message['От кого (ФИО)'],
      toId: message['Кому (ID)'],
      toName: message['Кому (ФИО)'],
      role: message['Роль'] || 'Сотрудник',
      text: message['Текст'],
      date: message['Дата и время'],
      read: message['Прочитано'] === true || message['Прочитано'] === 'ДА' || message['Прочитано'] === 'Да',
      priority: message['Приоритет'] || 'Обычное'
    }));
}

// ==================== НАСТРОЙКА БАЗЫ ДАННЫХ ====================

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const requiredSheets = [
    'Сотрудники',
    'Номенклатура',
    'Цены',
    'Прайс услуг',
    'Начальные остатки',
    'Приход',
    'Расход',
    'Листы расхода',
    'Возвраты',
    'Чат',
    'Объявления',
    'Журнал изменений',
    'Настройки',
    'Отчёты'
  ];

  const sheetHeaders = {
    'Сотрудники': ['ID', 'Персональный номер', 'ФИО', 'Пароль (хэш)', 'Статус', 'Должность', 'Дата найма', 'Дата увольнения', 'Заблокирован', 'Телефон', 'Email', 'Дата регистрации', 'Последний вход', 'Примечание', 'Смена открыта'],
    'Номенклатура': ['ID', 'Название', 'Категория', 'Ед. измерения', 'Производитель', 'Количество в упаковке', 'Штрих-код', 'Актуальна', 'Дата создания', 'Примечание'],
    'Цены': ['ID', 'Номенклатура_ID', 'Название', 'Цена за ед. (₽)', 'Дата начала', 'Дата окончания', 'Кем изменено', 'Дата изменения', 'Примечание'],
    'Прайс услуг': SERVICE_PRICES_HEADERS,
    'Начальные остатки': ['ID', 'Сотрудник_ID', 'ФИО', 'Номенклатура_ID', 'Название', 'Количество', 'Ед. изм.', 'Дата', 'Кем внесено', 'Период', 'Примечание'],
    'Приход': ['ID', 'Сотрудник_ID', 'ФИО сотрудника', 'Дата', 'Месяц', 'Сумма (₽)', 'Количество смен', 'Кем внесено', 'Тип', 'Комментарий', 'Позиции (JSON)', 'Дата внесения', 'Архив'],
    'Расход': ['ID', 'Сотрудник_ID', 'Дата внесения', 'Дата вызова', 'Месяц', 'Номенклатура_ID', 'Количество', 'Пациент ФИО', 'Пациент ДР', 'Вызов_ID'],
    'Листы расхода': ['ID', 'Сотрудник_ID', 'Сотрудник', 'Пациент', 'Дата рождения пациента', 'Дата', 'Месяц', 'Категория выезда', 'Название терапии', 'Стоимость терапии', 'Позиции (JSON)', 'Итого по препаратам', 'Архив', 'Дата создания'],
    'Возвраты': ['ID', 'Сотрудник_ID', 'ФИО сотрудника', 'Дата создания', 'Месяц', 'Номенклатура_ID', 'Название', 'Ед. измерения', 'Количество', 'Статус', 'Кем скорректировано', 'Скорректированное кол-во', 'Комментарий', 'Причина'],
    'Чат': ['ID', 'От кого (ID)', 'От кого (ФИО)', 'Кому (ID)', 'Кому (ФИО)', 'Роль', 'Текст', 'Дата и время', 'Прочитано', 'Тип', 'Приоритет'],
    'Объявления': ['ID', 'Заголовок', 'Текст', 'Получатели', 'Кем создано', 'Дата', 'Активно'],
    'Журнал изменений': ['ID', 'Дата и время', 'Пользователь ID', 'Пользователь ФИО', 'Роль', 'Лист', 'Запись_ID', 'Действие', 'Поле', 'Было', 'Стало', 'IP', 'Устройство'],
    'Настройки': ['Ключ', 'Значение'],
    'Отчёты': ['ID', 'Тип', 'Период', 'Данные', 'Создано']
  };

  requiredSheets.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('Создан лист: ' + sheetName);
    }

    const headers = sheetHeaders[sheetName];
    if (headers && sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      Logger.log('Добавлены заголовки для листа: ' + sheetName);
    }
  });

  setupServicePrices();

  const defaultSheet = ss.getSheetByName('Лист1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Удалён стандартный лист "Лист1"');
  }

  Logger.log('База данных успешно настроена!');
  SpreadsheetApp.getUi().alert('База данных успешно настроена! Создано листов: ' + requiredSheets.length);
}
