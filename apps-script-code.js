/**
 * Apps Script для работы с базой данных АлкоСпас
 * 
 * ИНСТРУКЦИЯ ПО УСТАНОВКЕ:
 * 1. Откройте Google Sheets с базой данных
 * 2. Расширения → Apps Script
 * 3. Удалите весь существующий код
 * 4. Вставьте этот код
 * 5. Сохраните (Ctrl+S)
 * 6. Развернуть → Новое развертывание
 * 7. Тип: Веб-приложение
 * 8. Выполнять как: Я
 * 9. Доступ: Все
 * 10. Скопируйте URL и вставьте в приложение
 */

// Главная функция обработки GET запросов
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    switch(action) {
      case 'test':
        return testConnection();
      case 'authenticateEmployee':
        return authenticateEmployee(e.parameter.personalNumber, e.parameter.password);
      case 'getNomenclature':
        return getNomenclature();
      case 'getEmployeeExpenseSheets':
        return getEmployeeExpenseSheets(e.parameter.employeeId);
      case 'getEmployeeMessages':
        return getEmployeeMessages(e.parameter.employeeId);
      case 'getAnnouncements':
        return getAnnouncements();
      case 'updateEmployeeShift':
        return updateEmployeeShift(e.parameter.id, e.parameter.shiftOpen === 'true', e.parameter.status);
      default:
        return createErrorResponse('Неизвестное действие: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// Главная функция обработки POST запросов
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      case 'addExpenseSheet':
        return addExpenseSheet(data.data);
      case 'addChatMessage':
        return addChatMessage(data.data);
      case 'editChatMessage':
        return editChatMessage(data.data);
      case 'deleteChatMessage':
        return deleteChatMessage(data.data);
      case 'updateEmployeeShift':
        return updateEmployeeShift(data.data.id, data.data.shiftOpen, data.data.status);
      default:
        return createErrorResponse('Неизвестное действие POST: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// Тест подключения
function testConnection() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return createSuccessResponse({
    title: ss.getName(),
    sheets: ss.getSheets().map(s => s.getName())
  });
}

// Авторизация сотрудника
function authenticateEmployee(personalNumber, password) {
  if (!personalNumber || !password) {
    return createErrorResponse('Не указан персональный номер или пароль');
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сотрудники');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сотрудники" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Находим индексы колонок
  const personalNumberIdx = headers.indexOf('Персональный номер');
  const passwordIdx = headers.indexOf('Пароль (хэш)');
  
  if (personalNumberIdx === -1 || passwordIdx === -1) {
    return createErrorResponse('Не найдены необходимые колонки в таблице');
  }
  
  // Ищем сотрудника
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[personalNumberIdx] === personalNumber) {
      // Проверяем пароль (сравниваем хэши)
      const storedHash = row[passwordIdx];
      const inputHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
        .join('');
      
      if (storedHash === inputHash) {
        // Возвращаем данные сотрудника
        const employee = {
          id: row[headers.indexOf('ID')] || 'EMP-' + i,
          personalNumber: row[personalNumberIdx],
          fullName: row[headers.indexOf('ФИО')] || '',
          status: row[headers.indexOf('Статус')] || 'Активен',
          position: row[headers.indexOf('Должность')] || '',
          hireDate: row[headers.indexOf('Дата найма')] || '',
          blocked: row[headers.indexOf('Заблокирован')] === true || row[headers.indexOf('Заблокирован')] === 'Да',
          phone: row[headers.indexOf('Телефон')] || '',
          lastActivity: row[headers.indexOf('Последняя активность')] || '',
          note: row[headers.indexOf('Примечание')] || '',
          shiftOpen: row[headers.indexOf('Смена открыта')] === true || row[headers.indexOf('Смена открыта')] === 'Да'
        };
        
        return createSuccessResponse(employee);
      } else {
        return createErrorResponse('Неверный пароль');
      }
    }
  }
  
  return createErrorResponse('Сотрудник не найден');
}

// Получение номенклатуры
function getNomenclature() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Номенклатура');
  
  if (!sheet) {
    return createErrorResponse('Лист "Номенклатура" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // Если есть ID
      items.push({
        id: row[headers.indexOf('ID')] || 'NOM-' + i,
        name: row[headers.indexOf('Наименование')] || '',
        category: row[headers.indexOf('Категория')] || '',
        unit: row[headers.indexOf('Единица измерения')] || '',
        manufacturer: row[headers.indexOf('Производитель')] || '',
        active: row[headers.indexOf('Активен')] !== false && row[headers.indexOf('Активен')] !== 'Нет',
        currentPrice: parseFloat(row[headers.indexOf('Цена')] || 0),
        packageQuantity: parseInt(row[headers.indexOf('Количество в упаковке')] || 1)
      });
    }
  }
  
  return createSuccessResponse(items);
}

// Получение листов расхода сотрудника
function getEmployeeExpenseSheets(employeeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Листы расхода');
  
  if (!sheet) {
    return createErrorResponse('Лист "Листы расхода" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sheets = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('ID сотрудника')] === employeeId) {
      sheets.push({
        id: row[headers.indexOf('ID')] || 'SHEET-' + i,
        employeeId: row[headers.indexOf('ID сотрудника')],
        employeeName: row[headers.indexOf('ФИО сотрудника')],
        patientName: row[headers.indexOf('ФИО пациента')],
        patientBirthDate: row[headers.indexOf('Дата рождения пациента')],
        date: row[headers.indexOf('Дата')],
        month: row[headers.indexOf('Месяц')],
        callCategory: row[headers.indexOf('Категория выезда')],
        therapyName: row[headers.indexOf('Название терапии')],
        therapyCost: parseFloat(row[headers.indexOf('Стоимость терапии')] || 0),
        items: JSON.parse(row[headers.indexOf('Препараты')] || '[]'),
        totalAmount: parseFloat(row[headers.indexOf('Общая сумма')] || 0),
        archived: row[headers.indexOf('Архивный')] === true || row[headers.indexOf('Архивный')] === 'Да'
      });
    }
  }
  
  return createSuccessResponse(sheets);
}

// Добавление листа расхода
function addExpenseSheet(sheetData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Листы расхода');
  
  if (!sheet) {
    return createErrorResponse('Лист "Листы расхода" не найден');
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  sheet.appendRow([
    sheetData.id || 'SHEET-' + new Date().getTime(),
    sheetData.employeeId,
    sheetData.employeeName,
    sheetData.patientName,
    sheetData.patientBirthDate,
    sheetData.date,
    sheetData.month,
    sheetData.callCategory,
    sheetData.therapyName,
    sheetData.therapyCost,
    JSON.stringify(sheetData.items),
    sheetData.totalAmount,
    sheetData.archived || false
  ]);
  
  return createSuccessResponse(sheetData);
}

// Получение сообщений сотрудника
function getEmployeeMessages(employeeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сообщения');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сообщения" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const messages = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fromId = row[headers.indexOf('От кого (ID)')];
    const toId = row[headers.indexOf('Кому (ID)')];
    
    // Возвращаем сообщения, где сотрудник является отправителем или получателем
    if (fromId === employeeId || toId === employeeId) {
      messages.push({
        id: row[headers.indexOf('ID')] || 'MSG-' + i,
        fromId: fromId,
        fromName: row[headers.indexOf('От кого (Имя)')],
        toId: toId,
        toName: row[headers.indexOf('Кому (Имя)')],
        role: row[headers.indexOf('Роль')] || 'Сотрудник',
        text: row[headers.indexOf('Текст')],
        date: row[headers.indexOf('Дата')],
        read: row[headers.indexOf('Прочитано')] === true || row[headers.indexOf('Прочитано')] === 'Да',
        priority: row[headers.indexOf('Приоритет')] || 'Обычное'
      });
    }
  }
  
  return createSuccessResponse(messages);
}

// Добавление сообщения
function addChatMessage(messageData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сообщения');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сообщения" не найден');
  }
  
  const messageId = 'MSG-' + new Date().getTime();
  const now = new Date();
  
  sheet.appendRow([
    messageId,
    messageData.fromId,
    messageData.fromName,
    messageData.toId,
    messageData.toName,
    messageData.role,
    messageData.text,
    now,
    messageData.read || false,
    messageData.priority || 'Обычное'
  ]);
  
  return createSuccessResponse({
    ...messageData,
    id: messageId,
    date: now
  });
}

// Редактирование сообщения
function editChatMessage(messageData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сообщения');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сообщения" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('ID');
  const textIdx = headers.indexOf('Текст');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === messageData.id) {
      sheet.getRange(i + 1, textIdx + 1).setValue(messageData.text);
      return createSuccessResponse({ success: true });
    }
  }
  
  return createErrorResponse('Сообщение не найдено');
}

// Удаление сообщения
function deleteChatMessage(messageData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сообщения');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сообщения" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('ID');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === messageData.id) {
      sheet.deleteRow(i + 1);
      return createSuccessResponse({ success: true });
    }
  }
  
  return createErrorResponse('Сообщение не найдено');
}

// Получение объявлений
function getAnnouncements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Объявления');
  
  if (!sheet) {
    return createErrorResponse('Лист "Объявления" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const announcements = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // Если есть ID
      announcements.push({
        id: row[headers.indexOf('ID')] || 'ANN-' + i,
        title: row[headers.indexOf('Заголовок')],
        text: row[headers.indexOf('Текст')],
        recipients: JSON.parse(row[headers.indexOf('Получатели')] || '[]'),
        createdBy: row[headers.indexOf('Создано кем')],
        date: row[headers.indexOf('Дата')],
        active: row[headers.indexOf('Активно')] !== false && row[headers.indexOf('Активно')] !== 'Нет'
      });
    }
  }
  
  return createSuccessResponse(announcements);
}

// Обновление статуса смены
function updateEmployeeShift(employeeId, shiftOpen, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Сотрудники');
  
  if (!sheet) {
    return createErrorResponse('Лист "Сотрудники" не найден');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('ID');
  const shiftOpenIdx = headers.indexOf('Смена открыта');
  const statusIdx = headers.indexOf('Статус');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === employeeId) {
      if (shiftOpenIdx !== -1) {
        sheet.getRange(i + 1, shiftOpenIdx + 1).setValue(shiftOpen ? 'Да' : 'Нет');
      }
      if (statusIdx !== -1 && status) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(status);
      }
      return createSuccessResponse({ success: true });
    }
  }
  
  return createErrorResponse('Сотрудник не найден');
}

// Вспомогательные функции
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(error) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: error }))
    .setMimeType(ContentService.MimeType.JSON);
}
