// lib/ai/actionExecutor.js

/**
 * AI Action Executor
 * Ejecuta acciones de forma segura con retry logic y manejo de errores
 *
 * Tipos de acciones:
 * - SQL: Ejecuta queries validados en la BD
 * - Telegram: Envía, edita, elimina mensajes
 * - Memory: Gestiona memoria persistente de la IA
 */

import { query } from "@/lib/db";
import {
  validateSQLQuery,
  sanitizeParams,
  validateResultLimits,
} from "./sqlValidator";
import {
  analyzeDBError,
  generateSchemaFeedback,
  getTableSchema,
} from "./schemaInspector";
import fetch from "node-fetch";

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Configuración de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // ms
  maxDelay: 5000,
  backoffMultiplier: 2,
};

/**
 * Ejecuta una lista de acciones secuencialmente
 * @param {Array} actions - Array de acciones a ejecutar
 * @param {Object} context - Contexto de ejecución
 * @returns {Promise<Object>} - Resultados de todas las acciones
 */
export async function executeActions(actions, context = {}) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return {
      success: true,
      results: [],
      errors: [],
    };
  }

  const results = [];
  const errors = [];

  console.log(`🎯 Executing ${actions.length} action(s)...`);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`\n📌 Action ${i + 1}/${actions.length}: ${action.type}`);

    try {
      const result = await executeAction(action, context);
      results.push({
        actionIndex: i,
        type: action.type,
        success: true,
        result: result.data,
        executionTime: result.executionTime,
      });
      console.log(`✅ Action ${i + 1} completed successfully`);
    } catch (error) {
      console.error(`❌ Action ${i + 1} failed:`, error.message);
      errors.push({
        actionIndex: i,
        type: action.type,
        error: error.message,
        stack: error.stack,
        action: action.data,
      });

      // Si es una acción crítica, detener ejecución
      if (action.critical) {
        console.log(`🛑 Critical action failed, stopping execution`);
        break;
      }
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    totalActions: actions.length,
    successCount: results.length,
    errorCount: errors.length,
  };
}

/**
 * Ejecuta una sola acción con retry logic
 * @param {Object} action - Acción a ejecutar
 * @param {Object} context - Contexto de ejecución
 * @returns {Promise<Object>} - Resultado de la acción
 */
async function executeAction(action, context) {
  const startTime = Date.now();
  let lastError = null;
  let attempt = 0;

  while (attempt < RETRY_CONFIG.maxRetries) {
    try {
      let result;

      switch (action.type) {
        case "sql":
          result = await executeSQLAction(action.data, context);
          break;

        case "telegram":
          result = await executeTelegramAction(action.data, context);
          break;

        case "memory":
          result = await executeMemoryAction(action.data, context);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      const executionTime = Date.now() - startTime;
      return {
        data: result,
        executionTime,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay *
            Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
          RETRY_CONFIG.maxDelay,
        );
        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw new Error(
    `Action failed after ${RETRY_CONFIG.maxRetries} attempts: ${lastError.message}`,
  );
}

/**
 * Ejecuta una acción SQL
 */
async function executeSQLAction(data, context) {
  const { query: sqlQuery, params = [] } = data;

  console.log(`🗄️ Executing SQL: ${sqlQuery.substring(0, 100)}...`);
  console.log(`   Params:`, params);

  // Validar query
  const validation = validateSQLQuery(sqlQuery, params, context);
  if (!validation.valid) {
    throw new Error(`SQL validation failed: ${validation.error}`);
  }

  const {
    query: sanitizedQuery,
    params: sanitizedParams,
    operation,
  } = validation.sanitized;

  // Sanitizar parámetros
  const finalParams = sanitizeParams(params);

  try {
    // Ejecutar query
    const result = await query(sanitizedQuery, finalParams);

    // Validar límites de resultados
    const limitCheck = validateResultLimits(result, operation);
    if (!limitCheck.valid) {
      throw new Error(limitCheck.error);
    }

    console.log(`   Result: ${result.rowCount} row(s) affected/returned`);

    return {
      operation,
      rowCount: result.rowCount,
      rows: result.rows || [],
      success: true,
    };
  } catch (dbError) {
    // Analizar si es un error de esquema
    const analysis = analyzeDBError(dbError);

    if (analysis.isSchemaError) {
      console.log(`   🔍 Schema error detected: ${analysis.errorType}`);

      // Generar feedback con información del esquema real
      const feedback = await generateSchemaFeedback(
        dbError,
        sanitizedQuery,
        context,
      );

      // Crear un error más descriptivo con el feedback
      const enhancedError = new Error(feedback);
      enhancedError.isSchemaError = true;
      enhancedError.originalError = dbError;
      enhancedError.analysis = analysis;

      throw enhancedError;
    }

    // Si no es error de esquema, relanzar el error original
    throw dbError;
  }
}

/**
 * Ejecuta una acción de Telegram
 */
async function executeTelegramAction(data, context) {
  const { action: telegramAction } = data;

  console.log(`📱 Executing Telegram action: ${telegramAction}`);

  let result;

  switch (telegramAction) {
    case "sendMessage":
      result = await sendTelegramMessage(data);
      break;

    case "editMessage":
      result = await editTelegramMessage(data);
      break;

    case "deleteMessage":
      result = await deleteTelegramMessage(data);
      break;

    case "sendSticker":
      result = await sendTelegramSticker(data);
      break;

    default:
      throw new Error(`Unknown Telegram action: ${telegramAction}`);
  }

  return result;
}

/**
 * Envía un mensaje de Telegram
 */
async function sendTelegramMessage(data) {
  const { chat_id, text, parse_mode = "HTML", reply_to_message_id } = data;

  const payload = {
    chat_id,
    text,
    parse_mode,
  };

  if (reply_to_message_id) {
    payload.reply_to_message_id = reply_to_message_id;
  }

  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || "Unknown error"}`,
    );
  }

  console.log(`   Message sent, message_id: ${result.result.message_id}`);

  return {
    success: true,
    message_id: result.result.message_id,
    chat_id: result.result.chat.id,
  };
}

/**
 * Edita un mensaje de Telegram
 */
async function editTelegramMessage(data) {
  const { chat_id, message_id, text, parse_mode = "HTML" } = data;

  const payload = {
    chat_id,
    message_id,
    text,
    parse_mode,
  };

  const response = await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || "Unknown error"}`,
    );
  }

  console.log(`   Message edited, message_id: ${message_id}`);

  return {
    success: true,
    message_id,
    edited: true,
  };
}

/**
 * Elimina un mensaje de Telegram
 */
async function deleteTelegramMessage(data) {
  const { chat_id, message_id } = data;

  const response = await fetch(`${TELEGRAM_API_URL}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, message_id }),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || "Unknown error"}`,
    );
  }

  console.log(`   Message deleted, message_id: ${message_id}`);

  return {
    success: true,
    message_id,
    deleted: true,
  };
}

/**
 * Envía un sticker de Telegram
 */
async function sendTelegramSticker(data) {
  const { chat_id, sticker, reply_to_message_id } = data;

  const payload = {
    chat_id,
    sticker,
  };

  if (reply_to_message_id) {
    payload.reply_to_message_id = reply_to_message_id;
  }

  const response = await fetch(`${TELEGRAM_API_URL}/sendSticker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || "Unknown error"}`,
    );
  }

  console.log(`   Sticker sent, message_id: ${result.result.message_id}`);

  return {
    success: true,
    message_id: result.result.message_id,
    chat_id: result.result.chat.id,
  };
}

/**
 * Ejecuta una acción de memoria
 */
async function executeMemoryAction(data, context) {
  const { operation, key, value } = data;

  console.log(`🧠 Executing memory operation: ${operation}`);

  // Asegurar que la tabla ai_memory existe
  await ensureMemoryTableExists();

  let result;

  switch (operation) {
    case "save":
      result = await saveMemory(key, value, context);
      break;

    case "get":
      result = await getMemory(key, context);
      break;

    case "delete":
      result = await deleteMemory(key, context);
      break;

    case "list":
      result = await listMemory(context);
      break;

    default:
      throw new Error(`Unknown memory operation: ${operation}`);
  }

  return result;
}

/**
 * Asegura que la tabla ai_memory existe
 */
async function ensureMemoryTableExists() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ai_memory (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      key VARCHAR(255) NOT NULL,
      value JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chat_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_memory_chat_id ON ai_memory(chat_id);
    CREATE INDEX IF NOT EXISTS idx_ai_memory_key ON ai_memory(key);
  `;

  try {
    await query(createTableQuery);
  } catch (error) {
    // Tabla ya existe, ignorar
    if (!error.message.includes("already exists")) {
      console.error("Error creating ai_memory table:", error);
    }
  }
}

/**
 * Guarda un valor en memoria
 */
async function saveMemory(key, value, context) {
  const chatId = context.chat_id || context.chatId;
  if (!chatId) {
    throw new Error("chat_id is required for memory operations");
  }

  // Convertir value a JSON si no lo es
  const jsonValue = typeof value === "string" ? value : JSON.stringify(value);

  const upsertQuery = `
    INSERT INTO ai_memory (chat_id, key, value, updated_at)
    VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (chat_id, key)
    DO UPDATE SET value = $3::jsonb, updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const result = await query(upsertQuery, [chatId, key, jsonValue]);

  console.log(`   Memory saved: ${key} = ${jsonValue.substring(0, 50)}...`);

  return {
    success: true,
    key,
    value: result.rows[0].value,
    updated_at: result.rows[0].updated_at,
  };
}

/**
 * Obtiene un valor de memoria
 */
async function getMemory(key, context) {
  const chatId = context.chat_id || context.chatId;
  if (!chatId) {
    throw new Error("chat_id is required for memory operations");
  }

  const selectQuery = `
    SELECT * FROM ai_memory
    WHERE chat_id = $1 AND key = $2;
  `;

  const result = await query(selectQuery, [chatId, key]);

  if (result.rows.length === 0) {
    console.log(`   Memory key not found: ${key}`);
    return {
      success: true,
      key,
      value: null,
      found: false,
    };
  }

  console.log(`   Memory retrieved: ${key}`);

  return {
    success: true,
    key,
    value: result.rows[0].value,
    found: true,
    created_at: result.rows[0].created_at,
    updated_at: result.rows[0].updated_at,
  };
}

/**
 * Elimina un valor de memoria
 */
async function deleteMemory(key, context) {
  const chatId = context.chat_id || context.chatId;
  if (!chatId) {
    throw new Error("chat_id is required for memory operations");
  }

  const deleteQuery = `
    DELETE FROM ai_memory
    WHERE chat_id = $1 AND key = $2
    RETURNING *;
  `;

  const result = await query(deleteQuery, [chatId, key]);

  console.log(`   Memory deleted: ${key}`);

  return {
    success: true,
    key,
    deleted: result.rowCount > 0,
  };
}

/**
 * Lista todas las memorias del chat
 */
async function listMemory(context) {
  const chatId = context.chat_id || context.chatId;
  if (!chatId) {
    throw new Error("chat_id is required for memory operations");
  }

  const listQuery = `
    SELECT key, value, created_at, updated_at
    FROM ai_memory
    WHERE chat_id = $1
    ORDER BY updated_at DESC
    LIMIT 100;
  `;

  const result = await query(listQuery, [chatId]);

  console.log(`   Memory list: ${result.rows.length} item(s)`);

  return {
    success: true,
    count: result.rows.length,
    memories: result.rows,
  };
}

/**
 * Formatea resultados de acciones para ser legibles por la IA
 */
export function formatResultsForAI(executionResult) {
  if (!executionResult.success) {
    return `❌ Execution failed:\n${executionResult.errors.map((e) => `- ${e.error}`).join("\n")}`;
  }

  if (executionResult.results.length === 0) {
    return "✅ No actions to execute";
  }

  let formatted = `✅ Executed ${executionResult.successCount}/${executionResult.totalActions} action(s):\n\n`;

  for (const result of executionResult.results) {
    formatted += `${result.actionIndex + 1}. [${result.type}] `;

    if (result.type === "sql") {
      formatted += `${result.result.operation} - ${result.result.rowCount} row(s)\n`;
      if (result.result.rows && result.result.rows.length > 0) {
        formatted += `   Data: ${JSON.stringify(result.result.rows[0], null, 2)}\n`;
      }
    } else if (result.type === "telegram") {
      formatted += `Success - message_id: ${result.result.message_id || "N/A"}\n`;
    } else if (result.type === "memory") {
      formatted += `Success - ${result.result.key || "operation completed"}\n`;
    }
  }

  if (executionResult.errors.length > 0) {
    formatted += `\n⚠️ ${executionResult.errorCount} error(s):\n`;
    for (const error of executionResult.errors) {
      formatted += `${error.actionIndex + 1}. [${error.type}] ${error.error}\n`;
    }
  }

  return formatted;
}

/**
 * Helper: sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifica si un error tiene información de esquema útil
 */
export function hasSchemaFeedback(error) {
  return error && error.isSchemaError === true;
}

/**
 * Extrae el feedback de esquema de un error
 */
export function getSchemaFeedback(error) {
  if (!hasSchemaFeedback(error)) return null;
  return {
    feedback: error.message,
    analysis: error.analysis,
    originalError: error.originalError,
  };
}

export default {
  executeActions,
  formatResultsForAI,
  hasSchemaFeedback,
  getSchemaFeedback,
};
