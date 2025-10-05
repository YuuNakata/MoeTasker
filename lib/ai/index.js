// lib/ai/index.js

/**
 * AI Actions System - Main Orchestrator
 *
 * Sistema completo de ejecución autónoma de acciones para la IA.
 * Integra parsing, validación, ejecución y retry logic.
 *
 * @module ai
 */

import {
  parseActions,
  processAIResponse,
  validateAction,
  filterValidActions,
} from "./actionParser";

import {
  executeActions,
  formatResultsForAI,
  hasSchemaFeedback,
  getSchemaFeedback,
} from "./actionExecutor";

import { validateSQLQuery, getAISecurityInfo } from "./sqlValidator";

import {
  generateAISystemPrompt,
  generateSimplePrompt,
  generateActionDocumentation,
} from "./systemPrompt";

import {
  getTableSchema,
  getMultipleTableSchemas,
  listAllTables,
  analyzeDBError,
  generateSchemaFeedback,
  generateSchemaDocumentation,
  clearSchemaCache,
} from "./schemaInspector";

import {
  executeIteratively,
  configureIterativeExecutor,
} from "./iterativeExecutor";

/**
 * Procesa la respuesta completa de la IA con acciones y las ejecuta
 *
 * @param {string} aiResponse - Respuesta de la IA que puede contener acciones
 * @param {Object} context - Contexto de ejecución
 * @param {number} context.chat_id - ID del chat
 * @param {number} context.user_id - ID del usuario
 * @param {string} context.username - Username del usuario
 * @param {Object} options - Opciones de ejecución
 * @param {boolean} options.dryRun - Si true, solo parsea sin ejecutar
 * @param {boolean} options.autoRetry - Si true, reintenta automáticamente en errores
 * @param {number} options.maxRetries - Máximo de reintentos (default: 3)
 *
 * @returns {Promise<Object>} Resultado completo del procesamiento
 */
export async function processAIResponseWithActions(
  aiResponse,
  context = {},
  options = {},
) {
  const { dryRun = false, autoRetry = true, maxRetries = 3 } = options;

  console.log("\n🤖 ===== AI ACTIONS PROCESSING START =====");
  console.log(`📝 Response length: ${aiResponse?.length || 0} chars`);
  console.log(`🎯 Context:`, {
    chat_id: context.chat_id || context.chatId,
    user_id: context.user_id || context.userId,
  });

  // 1. Parsear la respuesta y extraer acciones
  const processed = processAIResponse(aiResponse, context);

  console.log(`\n📊 Parsing Results:`);
  console.log(`   Valid actions: ${processed.actions.length}`);
  console.log(`   Invalid actions: ${processed.invalidActions.length}`);
  console.log(`   Message length: ${processed.message?.length || 0} chars`);

  // Log de acciones inválidas si existen
  if (processed.invalidActions.length > 0) {
    console.log(`\n⚠️  Invalid Actions:`);
    processed.invalidActions.forEach((action, idx) => {
      console.log(`   ${idx + 1}. [${action.type}] ${action.validationError}`);
    });
  }

  // Si no hay acciones válidas, retornar solo el mensaje
  if (!processed.hasActions) {
    console.log("✅ No actions to execute, returning message only");
    console.log("🤖 ===== AI ACTIONS PROCESSING END =====\n");
    return {
      success: true,
      message: processed.message,
      hasActions: false,
      executionResults: null,
    };
  }

  // Log de acciones a ejecutar
  console.log(`\n📋 Actions to execute:`);
  processed.actions.forEach((action, idx) => {
    console.log(
      `   ${idx + 1}. [${action.type}]`,
      action.type === "sql"
        ? action.data.query.substring(0, 60) + "..."
        : action.data.action || "operation",
    );
  });

  // Si es dry run, no ejecutar
  if (dryRun) {
    console.log("\n🏃 Dry run mode - skipping execution");
    console.log("🤖 ===== AI ACTIONS PROCESSING END =====\n");
    return {
      success: true,
      message: processed.message,
      hasActions: true,
      actions: processed.actions,
      dryRun: true,
      executionResults: null,
    };
  }

  // 2. Ejecutar acciones
  let executionResults;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `\n🚀 Executing actions (attempt ${attempt + 1}/${maxRetries})...`,
      );

      executionResults = await executeActions(processed.actions, context);

      console.log(`\n📈 Execution Results:`);
      console.log(`   Success: ${executionResults.success}`);
      console.log(
        `   Completed: ${executionResults.successCount}/${executionResults.totalActions}`,
      );
      console.log(`   Errors: ${executionResults.errorCount}`);

      // Si todas las acciones se ejecutaron exitosamente, salir del loop
      if (executionResults.success || !autoRetry) {
        break;
      }

      // Si hay errores y autoRetry está activo, intentar nuevamente
      attempt++;
      if (attempt < maxRetries) {
        console.log(`\n🔄 Retrying due to errors...`);
        await sleep(1000 * attempt); // Backoff exponencial
      }
    } catch (error) {
      console.error(`\n❌ Fatal error executing actions:`, error);

      executionResults = {
        success: false,
        results: [],
        errors: [
          {
            error: error.message,
            stack: error.stack,
          },
        ],
        totalActions: processed.actions.length,
        successCount: 0,
        errorCount: 1,
      };

      attempt++;
      if (attempt >= maxRetries || !autoRetry) {
        break;
      }
    }
  }

  console.log("🤖 ===== AI ACTIONS PROCESSING END =====\n");

  return {
    success: executionResults.success,
    message: processed.message,
    hasActions: true,
    actions: processed.actions,
    executionResults,
    attempts: attempt + 1,
  };
}

/**
 * Ejecuta una sola acción de forma aislada
 * Útil para testing o ejecución manual
 *
 * @param {Object} action - Acción a ejecutar
 * @param {Object} context - Contexto de ejecución
 * @returns {Promise<Object>} Resultado de la ejecución
 */
export async function executeSingleAction(action, context = {}) {
  // Validar acción
  const validation = validateAction(action);
  if (!validation.valid) {
    throw new Error(`Action validation failed: ${validation.error}`);
  }

  // Ejecutar
  const results = await executeActions([action], context);

  return results.results[0] || results.errors[0];
}

/**
 * Genera un mensaje formateado con los resultados de ejecución
 * para mostrar al usuario o enviar de vuelta a la IA
 *
 * @param {Object} processingResult - Resultado de processAIResponseWithActions
 * @param {Object} options - Opciones de formato
 * @returns {string} Mensaje formateado
 */
export function formatProcessingResults(processingResult, options = {}) {
  const {
    includeMessage = true,
    includeExecutionDetails = true,
    forUser = true, // Si false, formato para la IA
  } = options;

  let formatted = "";

  // Incluir mensaje original
  if (includeMessage && processingResult.message) {
    formatted += processingResult.message;
    if (includeExecutionDetails && processingResult.hasActions) {
      formatted += "\n\n---\n\n";
    }
  }

  // Incluir detalles de ejecución
  if (includeExecutionDetails && processingResult.hasActions) {
    if (forUser) {
      // Formato amigable para usuario
      if (processingResult.executionResults?.success) {
        formatted += `✅ Se ejecutaron ${processingResult.executionResults.successCount} acción(es) exitosamente.`;
      } else {
        formatted += `⚠️ Algunas acciones fallaron (${processingResult.executionResults?.errorCount || 0} error(es)).`;
      }
    } else {
      // Formato detallado para la IA
      formatted += formatResultsForAI(processingResult.executionResults);
    }
  }

  return formatted.trim();
}

/**
 * Valida si un texto contiene acciones válidas sin ejecutarlas
 *
 * @param {string} text - Texto a validar
 * @returns {Object} Resultado de validación
 */
export function validateActionsInText(text) {
  const parsed = parseActions(text);
  const { valid, invalid } = filterValidActions(parsed.actions);

  return {
    hasActions: parsed.hasActions,
    validCount: valid.length,
    invalidCount: invalid.length,
    actions: valid,
    invalidActions: invalid,
    message: parsed.cleanText,
  };
}

/**
 * Helper para crear contexto desde un mensaje de Telegram
 *
 * @param {Object} message - Mensaje de Telegram
 * @returns {Object} Contexto listo para usar
 */
export function createContextFromTelegramMessage(message) {
  return {
    chat_id: message.chat.id,
    chatId: message.chat.id,
    user_id: message.from.id,
    userId: message.from.id,
    username: message.from.username,
    first_name: message.from.first_name,
    message_id: message.message_id,
  };
}

/**
 * Obtiene información de configuración de seguridad para mostrar
 *
 * @returns {Object} Información de seguridad
 */
export function getSecurityInfo() {
  return getAISecurityInfo();
}

/**
 * Genera el system prompt para la IA con capacidades de acciones
 *
 * @param {Object} config - Configuración del prompt
 * @returns {string} System prompt
 */
export function generateSystemPrompt(config = {}) {
  return generateAISystemPrompt(config);
}

/**
 * Genera documentación de acciones para el usuario
 *
 * @returns {string} Documentación en Markdown
 */
export function getActionDocumentation() {
  return generateActionDocumentation();
}

/**
 * Health check del sistema de acciones
 *
 * @returns {Promise<Object>} Estado del sistema
 */
export async function healthCheck() {
  const info = getAISecurityInfo();

  return {
    status: "healthy",
    capabilities: {
      sql: true,
      telegram: true,
      memory: true,
    },
    security: {
      allowedTables: info.allowedTables.length,
      allowedOperations: info.allowedOperations.length,
      limits: info.limits,
    },
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper: sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exportaciones principales
export {
  // Parsing
  parseActions,
  processAIResponse,
  validateAction,

  // Execution
  executeActions,
  formatResultsForAI,
  hasSchemaFeedback,
  getSchemaFeedback,

  // Validation
  validateSQLQuery,
  getAISecurityInfo,

  // Prompts
  generateAISystemPrompt,
  generateSimplePrompt,
  generateActionDocumentation,

  // Schema Inspector
  getTableSchema,
  getMultipleTableSchemas,
  listAllTables,
  analyzeDBError,
  generateSchemaFeedback,
  generateSchemaDocumentation,
  clearSchemaCache,

  // Iterative Executor
  executeIteratively,
  configureIterativeExecutor,
};

// Default export con las funciones principales
export default {
  processAIResponseWithActions,
  executeSingleAction,
  formatProcessingResults,
  validateActionsInText,
  createContextFromTelegramMessage,
  getSecurityInfo,
  generateSystemPrompt,
  getActionDocumentation,
  healthCheck,
  // Schema Inspector
  getTableSchema,
  analyzeDBError,
  generateSchemaFeedback,
  clearSchemaCache,
  // Iterative Executor
  executeIteratively,
  configureIterativeExecutor,
};
