/**
 * СМУ - Система Медицинского Учёта
 * Google Apps Script Web App для руководителя + сотрудника
 * Версия 0.5.4
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
        return jsonResponse(getEmployeesData());
      case 'getNomenclature':
        return jsonResponse(getNomenclatureData());
      case 'getPrices':
        return jsonResponse(getPricesData());
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

function doPost(e) {
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

      // Чат
      case 'addChatMessage':
        addChatMessageData(data);
        return jsonResponse({ success: true });
      case 'updateChatMessage': {
        const { id, ...updates } = data;
        updateChatMessageData(id, updates);
        return jsonResponse({ success: true });
      }
      case 'editChatMessage':
        updateChatMessageData(data.id, { 'Текст': data.text });
        return jsonResponse({ success: true });
      case 'deleteChatMessage':
        deleteChatMessageData(data.id);
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

function appendRow(sheetName, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Лист не найден: ' + sheetName);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
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
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[key]);
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
  return readSheetData('Сотрудники');
}

function addEmployeeData(data) {
  appendRow('Сотрудники', data);
}

function updateEmployeeData(id, updates) {
  updateRow('Сотрудники', id, updates);
}

function updateEmployeeShiftData(id, shiftOpen) {
  updateRow('Сотрудники', id, { 'Смена открыта': shiftOpen ? 'ДА' : 'НЕТ' });
}

function deleteEmployeeData(id) {
  deleteRow('Сотрудники', id);
}

// ==================== НОМЕНКЛАТУРА ====================

function getNomenclatureData() {
  return readSheetData('Номенклатура');
}

function addNomenclatureData(data) {
  appendRow('Номенклатура', data);
}

function updateNomenclatureData(id, updates) {
  updateRow('Номенклатура', id, updates);
}

function deleteNomenclatureData(id) {
  deleteRow('Номенклатура', id);
}

// ==================== ЦЕНЫ ====================

function getPricesData() {
  return readSheetData('Цены');
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

function addArrivalData(data) {
  const positions = data.items ?? data['Позиции'] ?? data['Позиции (JSON)'];
  if (positions !== undefined) {
    const serializedPositions = typeof positions === 'string'
      ? positions
      : JSON.stringify(positions);
    data['Позиции'] = serializedPositions;
    data['Позиции (JSON)'] = serializedPositions;
  }
  appendRow('Приход', data);
}

function updateArrivalData(id, updates) {
  const positions = updates.items ?? updates['Позиции'] ?? updates['Позиции (JSON)'];
  if (positions !== undefined) {
    const serializedPositions = typeof positions === 'string'
      ? positions
      : JSON.stringify(positions);
    updates['Позиции'] = serializedPositions;
    updates['Позиции (JSON)'] = serializedPositions;
  }
  updateRow('Приход', id, updates);
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

  appendRow('Листы расхода', {
    'ID': data['ID'] || data.id || 'SHEET-' + Date.now(),
    'Сотрудник_ID': data['Сотрудник_ID'] ?? data.employeeId ?? '',
    'Сотрудник': data['Сотрудник'] ?? data.employeeName ?? '',
    'Пациент': data['Пациент'] ?? data.patientName ?? '',
    'Дата рождения пациента': data['Дата рождения пациента'] ?? data.patientBirthDate ?? '',
    'Дата': data['Дата'] ?? data.date ?? '',
    'Месяц': data['Месяц'] ?? data.month ?? '',
    'Категория выезда': data['Категория выезда'] ?? data.callCategory ?? '',
    'Название терапии': data['Название терапии'] ?? data.therapyName ?? '',
    'Стоимость терапии': data['Стоимость терапии'] ?? data.therapyCost ?? 0,
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
  appendRow('Возвраты', data);
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
      therapyCost: sheet['Стоимость терапии'],
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
    'Начальные остатки': ['ID', 'Сотрудник_ID', 'ФИО', 'Номенклатура_ID', 'Название', 'Количество', 'Ед. изм.', 'Дата', 'Кем внесено', 'Период', 'Примечание'],
    'Приход': ['ID', 'Сотрудник_ID', 'ФИО сотрудника', 'Дата', 'Месяц', 'Сумма (₽)', 'Количество смен', 'Кем внесено', 'Тип', 'Комментарий', 'Позиции (JSON)', 'Дата внесения', 'Архив'],
    'Расход': ['ID', 'Сотрудник_ID', 'Дата внесения', 'Дата вызова', 'Месяц', 'Номенклатура_ID', 'Количество', 'Пациент ФИО', 'Пациент ДР', 'Вызов_ID'],
    'Листы расхода': ['ID', 'Сотрудник_ID', 'Сотрудник', 'Пациент', 'Дата рождения пациента', 'Дата', 'Месяц', 'Категория выезда', 'Название терапии', 'Стоимость терапии', 'Позиции (JSON)', 'Итого по препаратам', 'Архив', 'Дата создания'],
    'Возвраты': ['ID', 'Сотрудник_ID', 'Дата создания', 'Номенклатура_ID', 'Количество', 'Статус', 'Кем скорректировано', 'Скорректированное кол-во', 'Комментарий', 'Причина'],
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

  const defaultSheet = ss.getSheetByName('Лист1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Удалён стандартный лист "Лист1"');
  }

  Logger.log('База данных успешно настроена!');
  SpreadsheetApp.getUi().alert('База данных успешно настроена! Создано листов: ' + requiredSheets.length);
}
