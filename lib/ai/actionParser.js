// lib/ai/actionParser.js

/**
 * AI Action Parser
 * Extrae y parsea acciones ejecutables del response de la IA
 *
 * Sintaxis soportada:
 * [ACTION:sql]
 * {"query": "SELECT * FROM tasks WHERE chat_id = $1", "params": [123]}
 * [/ACTION]
 *
 * [ACTION:telegram]
 * {"action": "sendMessage", "text": "Hola!", "chat_id": 123}
 * [/ACTION]
 *
 * [ACTION:memory]
 * {"operation": "save", "key": "last_task_id", "value": 42}
 * [/ACTION]
 */

const ACTION_REGEX = /\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/gi;

/**
 * Parsea el texto de la IA y extrae todas las acciones
 * @param {string} text - Respuesta de la IA que puede contener acciones
 * @returns {Object} - { actions: Array, cleanText: string, hasActions: boolean }
 */
export function parseActions(text) {
  if (!text || typeof text !== 'string') {
    return {
      actions: [],
      cleanText: text || '',
      hasActions: false
    };
  }

  const actions = [];
  let match;

  // Reset regex index
  ACTION_REGEX.lastIndex = 0;

  while ((match = ACTION_REGEX.exec(text)) !== null) {
    const actionType = match[1].toLowerCase();
    const jsonContent = match[2].trim();

    try {
      // Intentar parsear el JSON
      const parsedData = JSON.parse(jsonContent);

      actions.push({
        type: actionType,
        data: parsedData,
        raw: match[0],
        index: match.index
      });
    } catch (error) {
      console.error(`❌ Error parsing action ${actionType}:`, error.message);
      console.error(`Content:`, jsonContent);

      // Agregar acción con error para que se pueda reportar
      actions.push({
        type: actionType,
        data: null,
        error: error.message,
        raw: match[0],
        index: match.index,
        failed: true
      });
    }
  }

  // Remover los bloques de acción del texto para obtener el mensaje limpio
  const cleanText = text.replace(ACTION_REGEX, '').trim();

  return {
    actions,
    cleanText,
    hasActions: actions.length > 0
  };
}

/**
 * Valida que una acción tenga la estructura correcta
 * @param {Object} action - Acción parseada
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateAction(action) {
  if (!action || typeof action !== 'object') {
    return { valid: false, error: 'Action must be an object' };
  }

  if (!action.type) {
    return { valid: false, error: 'Action must have a type' };
  }

  if (action.failed) {
    return { valid: false, error: action.error || 'Action parsing failed' };
  }

  if (!action.data) {
    return { valid: false, error: 'Action must have data' };
  }

  // Validaciones específicas por tipo
  switch (action.type) {
    case 'sql':
      return validateSQLAction(action.data);

    case 'telegram':
      return validateTelegramAction(action.data);

    case 'memory':
      return validateMemoryAction(action.data);

    default:
      return { valid: false, error: `Unknown action type: ${action.type}` };
  }
}

/**
 * Valida una acción SQL
 */
function validateSQLAction(data) {
  if (!data.query || typeof data.query !== 'string') {
    return { valid: false, error: 'SQL action must have a query string' };
  }

  // Validar que la query no esté vacía
  if (data.query.trim().length === 0) {
    return { valid: false, error: 'SQL query cannot be empty' };
  }

  // params es opcional pero si existe debe ser array
  if (data.params !== undefined && !Array.isArray(data.params)) {
    return { valid: false, error: 'SQL params must be an array' };
  }

  return { valid: true, error: null };
}

/**
 * Valida una acción de Telegram
 */
function validateTelegramAction(data) {
  if (!data.action || typeof data.action !== 'string') {
    return { valid: false, error: 'Telegram action must have an action type' };
  }

  const validActions = ['sendMessage', 'editMessage', 'deleteMessage', 'sendSticker'];
  if (!validActions.includes(data.action)) {
    return {
      valid: false,
      error: `Invalid Telegram action: ${data.action}. Valid: ${validActions.join(', ')}`
    };
  }

  // Validaciones específicas por acción
  switch (data.action) {
    case 'sendMessage':
      if (!data.text) {
        return { valid: false, error: 'sendMessage requires text' };
      }
      if (!data.chat_id) {
        return { valid: false, error: 'sendMessage requires chat_id' };
      }
      break;

    case 'editMessage':
      if (!data.text) {
        return { valid: false, error: 'editMessage requires text' };
      }
      if (!data.message_id && !data.inline_message_id) {
        return { valid: false, error: 'editMessage requires message_id or inline_message_id' };
      }
      break;

    case 'deleteMessage':
      if (!data.chat_id) {
        return { valid: false, error: 'deleteMessage requires chat_id' };
      }
      if (!data.message_id) {
        return { valid: false, error: 'deleteMessage requires message_id' };
      }
      break;

    case 'sendSticker':
      if (!data.chat_id) {
        return { valid: false, error: 'sendSticker requires chat_id' };
      }
      if (!data.sticker) {
        return { valid: false, error: 'sendSticker requires sticker (file_id or URL)' };
      }
      break;
  }

  return { valid: true, error: null };
}

/**
 * Valida una acción de memoria
 */
function validateMemoryAction(data) {
  if (!data.operation || typeof data.operation !== 'string') {
    return { valid: false, error: 'Memory action must have an operation' };
  }

  const validOps = ['save', 'get', 'delete', 'list'];
  if (!validOps.includes(data.operation)) {
    return {
      valid: false,
      error: `Invalid memory operation: ${data.operation}. Valid: ${validOps.join(', ')}`
    };
  }

  if (['save', 'get', 'delete'].includes(data.operation) && !data.key) {
    return { valid: false, error: `${data.operation} operation requires a key` };
  }

  if (data.operation === 'save' && data.value === undefined) {
    return { valid: false, error: 'save operation requires a value' };
  }

  return { valid: true, error: null };
}

/**
 * Filtra y retorna solo las acciones válidas
 * @param {Array} actions - Array de acciones parseadas
 * @returns {Object} - { valid: Array, invalid: Array }
 */
export function filterValidActions(actions) {
  const valid = [];
  const invalid = [];

  for (const action of actions) {
    const validation = validateAction(action);
    if (validation.valid) {
      valid.push(action);
    } else {
      invalid.push({
        ...action,
        validationError: validation.error
      });
    }
  }

  return { valid, invalid };
}

/**
 * Reemplaza variables en el texto de una acción
 * Ejemplo: {chat_id} será reemplazado por el chat_id real
 * @param {Object} data - Data de la acción
 * @param {Object} context - Contexto con variables disponibles
 * @returns {Object} - Data con variables reemplazadas
 */
export function replaceVariables(data, context = {}) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const replaced = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      const varName = value.slice(1, -1);
      replaced[key] = context[varName] !== undefined ? context[varName] : value;
    } else if (typeof value === 'object' && value !== null) {
      replaced[key] = replaceVariables(value, context);
    } else if (Array.isArray(value)) {
      replaced[key] = value.map(item =>
        typeof item === 'object' ? replaceVariables(item, context) : item
      );
    } else {
      replaced[key] = value;
    }
  }

  return replaced;
}

/**
 * Procesa texto completo de la IA y retorna estructura lista para ejecutar
 * @param {string} text - Respuesta de la IA
 * @param {Object} context - Contexto para reemplazar variables
 * @returns {Object} - Estructura completa procesada
 */
export function processAIResponse(text, context = {}) {
  const parsed = parseActions(text);
  const { valid, invalid } = filterValidActions(parsed.actions);

  // Reemplazar variables en acciones válidas
  const processedActions = valid.map(action => ({
    ...action,
    data: replaceVariables(action.data, context)
  }));

  return {
    message: parsed.cleanText,
    actions: processedActions,
    invalidActions: invalid,
    hasActions: processedActions.length > 0,
    hasErrors: invalid.length > 0,
    context
  };
}

export default {
  parseActions,
  validateAction,
  filterValidActions,
  replaceVariables,
  processAIResponse
};
