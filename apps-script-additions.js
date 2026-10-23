/**
 * ДОБАВЬТЕ ЭТИ ФУНКЦИИ В СУЩЕСТВУЮЩИЙ КОД APPS SCRIPT
 * 
 * ВАЖНО: Не удаляйте существующие функции!
 * Просто добавьте новые в конец файла.
 */

// ============================================================================
// 1. ДОБАВЬТЕ В ФУНКЦИЮ doGet (если её нет, создайте):
// ============================================================================

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
      // ВАШИ СУЩЕСТВУЮЩИЕ ДЕЙСТВИЯ ДОЛЖНЫ БЫТЬ ЗДЕСЬ
      // НЕ УДАЛЯЙТЕ ИХ!
      default:
        return createErrorResponse('Неизвестное действие: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// ============================================================================
// 2. ДОБАВЬТЕ В ФУНКЦИЮ doPost (если её нет, создайте):
// ============================================================================

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
      // ВАШИ СУЩЕСТВУЮЩИЕ ДЕЙСТВИЯ ДОЛЖНЫ БЫТЬ ЗДЕСЬ
      // НЕ УДАЛЯЙТЕ ИХ!
      default:
        return createErrorResponse('Неизвестное действие POST: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// ============================================================================
// 3. ДОБАВЬТЕ ЭТИ НОВЫЕ ФУНКЦИИ В КОНЕЦ ФАЙЛА:
// ============================================================================

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

// ============================================================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (добавьте, если их нет):
// ============================================================================

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

// ============================================================================
// 5. ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ ХЭША ПАРОЛЯ (запустите один раз):
// ============================================================================

function generatePasswordHash() {
  const password = 'ваш_пароль_здесь'; // Замените на реальный пароль
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
    .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
    .join('');
  Logger.log('Хэш пароля: ' + hash);
  // Скопируйте этот хэш в таблицу в колонку "Пароль (хэш)"
}
