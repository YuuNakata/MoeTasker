// lib/ai/iterativeExecutor.js

/**
 * Iterative AI Executor
 * Permite a la IA ejecutar acciones de forma iterativa sin límites:
 * - Ejecuta acciones mientras existan en la respuesta
 * - Auto-corrige errores consultando esquema real
 * - Envía mensajes de progreso que edita en tiempo real
 * - Sin límite de iteraciones (hasta completar o timeout)
 */

import {
  processAIResponse,
  executeActions,
  hasSchemaFeedback,
  getSchemaFeedback,
} from "./index";
import { sendMessage, editMessageText } from "@/utils/telegram";
import Cerebras from "@cerebras/cerebras_cloud_sdk";

const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

// Configuración
const CONFIG = {
  MAX_ITERATIONS: 20, // Límite de seguridad (no debería alcanzarse normalmente)
  ITERATION_TIMEOUT: 60000, // 60 segundos timeout total
  SHOW_PROGRESS: true, // Mostrar progreso al usuario
  EDIT_PROGRESS_DELAY: 500, // Esperar 500ms antes de editar para no hacer spam
};

/**
 * Ejecuta la IA de forma iterativa hasta completar todas las acciones
 * @param {string} initialResponse - Respuesta inicial de la IA
 * @param {Object} context - Contexto de ejecución
 * @param {Object} systemPrompt - Prompt del sistema
 * @param {Array} conversationHistory - Historial de la conversación
 * @returns {Promise<Object>} Resultado final con todas las iteraciones
 */
export async function executeIteratively(
  initialResponse,
  context,
  systemPrompt,
  conversationHistory = [],
) {
  const startTime = Date.now();
  const iterations = [];
  let currentResponse = initialResponse;
  let progressMessageId = null;
  let allExecutionResults = [];
  let totalActionsExecuted = 0;
  let totalErrors = 0;

  console.log("\n🔄 ===== ITERATIVE EXECUTION START =====");

  // Pedir a la IA que genere un mensaje de espera personalizado
  let waitingMessage = "⏳ Trabajando en ello...";
  if (CONFIG.SHOW_PROGRESS && context.chat_id) {
    try {
      // Generar mensaje de espera con personalidad Moe
      waitingMessage = await generateWaitingMessage(
        systemPrompt,
        conversationHistory,
        initialResponse,
      );

      const progressMsg = await sendProgressMessage(
        context.chat_id,
        waitingMessage,
      );
      progressMessageId = progressMsg.message_id;
      console.log(`📨 Progress message sent with ID: ${progressMessageId}`);
    } catch (error) {
      console.error("Error sending progress message:", error);
    }
  }

  let iteration = 0;
  while (iteration < CONFIG.MAX_ITERATIONS) {
    iteration++;

    // Check timeout
    if (Date.now() - startTime > CONFIG.ITERATION_TIMEOUT) {
      console.log("⏱️ Iteration timeout reached");
      await updateProgressMessage(
        context.chat_id,
        progressMessageId,
        "⚠️ Proceso tomó demasiado tiempo, mostrando resultados parciales...",
      );
      break;
    }

    console.log(`\n🔄 Iteration ${iteration}/${CONFIG.MAX_ITERATIONS}`);
    console.log(`📝 Response length: ${currentResponse.length} chars`);

    // Parsear y procesar acciones
    const processed = processAIResponse(currentResponse, context);

    console.log(`   Actions found: ${processed.actions.length}`);
    console.log(`   Invalid actions: ${processed.invalidActions.length}`);

    // Si no hay acciones, terminamos
    if (!processed.hasActions) {
      console.log("✅ No more actions to execute");
      iterations.push({
        iteration,
        hasActions: false,
        message: processed.message,
        completed: true,
      });
      break;
    }

    // Actualizar progreso
    if (progressMessageId && context.chat_id) {
      await updateProgressMessage(
        context.chat_id,
        progressMessageId,
        `🔄 Ejecutando ${processed.actions.length} acción(es)... (${totalActionsExecuted} completadas)`,
      );
    }

    // Ejecutar acciones
    const executionResults = await executeActions(processed.actions, context);

    totalActionsExecuted += executionResults.successCount;
    totalErrors += executionResults.errorCount;
    allExecutionResults.push(executionResults);

    console.log(
      `   ✅ Executed: ${executionResults.successCount}/${executionResults.totalActions}`,
    );
    console.log(`   ❌ Errors: ${executionResults.errorCount}`);

    iterations.push({
      iteration,
      hasActions: true,
      actionsCount: processed.actions.length,
      executionResults,
      message: processed.message,
      errors: executionResults.errors,
    });

    // Si todas las acciones fallaron y no hay mensaje, intentar obtener feedback
    if (
      executionResults.errorCount > 0 &&
      executionResults.successCount === 0
    ) {
      console.log("⚠️ All actions failed, generating feedback...");

      // Verificar si hay errores de esquema
      const schemaErrors = executionResults.errors.filter((err) =>
        hasSchemaFeedback(err),
      );

      if (schemaErrors.length > 0) {
        console.log(
          `🔍 Found ${schemaErrors.length} schema error(s), getting feedback...`,
        );

        // Generar feedback con información de esquema
        let feedbackText = "**ERRORS DETECTED:**\n\n";
        for (const error of schemaErrors) {
          const feedback = getSchemaFeedback(error);
          feedbackText += `${feedback.feedback}\n\n`;
        }

        // Pedir a la IA que corrija con el feedback
        if (progressMessageId && context.chat_id) {
          await updateProgressMessage(
            context.chat_id,
            progressMessageId,
            "🔍 Detecté un error de esquema, auto-corrigiendo...",
          );
        }

        currentResponse = await askAIToFixError(
          systemPrompt,
          conversationHistory,
          currentResponse,
          feedbackText,
        );

        continue; // Reintentar con la corrección
      }

      // Si no es error de esquema, generar mensaje de error genérico
      console.log("❌ Non-schema errors, stopping iteration");
      const errorMessages = executionResults.errors
        .map((e) => e.error)
        .join("\n");
      if (progressMessageId && context.chat_id) {
        await updateProgressMessage(
          context.chat_id,
          progressMessageId,
          `❌ Error: ${errorMessages.substring(0, 200)}`,
        );
      }
      break;
    }

    // Si hubo acciones exitosas, preguntar a la IA si necesita hacer algo más
    if (executionResults.successCount > 0) {
      if (progressMessageId && context.chat_id) {
        await updateProgressMessage(
          context.chat_id,
          progressMessageId,
          `✅ ${totalActionsExecuted} acción(es) completadas. Generando respuesta...`,
        );
      }

      // Formatear resultados para la IA
      const resultsText = formatResultsForAI(executionResults);

      // Preguntar a la IA si necesita hacer algo más
      currentResponse = await askAIForNextStep(
        systemPrompt,
        conversationHistory,
        currentResponse,
        resultsText,
      );

      // Si la nueva respuesta no tiene acciones, es el mensaje final
      const nextCheck = processAIResponse(currentResponse, context);
      if (!nextCheck.hasActions) {
        console.log("✅ AI provided final message, iteration complete");
        iterations.push({
          iteration: iteration + 1,
          hasActions: false,
          message: currentResponse,
          completed: true,
          final: true,
        });
        break;
      }

      console.log("🔄 AI generated more actions, continuing...");
    }
  }

  // Eliminar mensaje de progreso después de completar
  if (progressMessageId && context.chat_id) {
    try {
      // Esperar un momento para que el usuario vea el último estado
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Intentar eliminar el mensaje de progreso
      const { deleteMessage } = await import("@/utils/telegram");
      await deleteMessage(context.chat_id, progressMessageId);
      console.log(`🗑️ Progress message deleted`);
    } catch (error) {
      // Ignorar errores al eliminar mensaje de progreso
      console.log("Could not delete progress message:", error.message);
    }
  }

  const totalTime = Date.now() - startTime;

  console.log("\n📊 Iteration Summary:");
  console.log(`   Total iterations: ${iteration}`);
  console.log(`   Total actions executed: ${totalActionsExecuted}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log("🔄 ===== ITERATIVE EXECUTION END =====\n");

  // Obtener mensaje final
  const finalIteration = iterations[iterations.length - 1];
  const finalMessage = finalIteration?.message || currentResponse;

  return {
    success: totalErrors === 0 || totalActionsExecuted > 0,
    message: finalMessage,
    iterations: iteration,
    totalActionsExecuted,
    totalErrors,
    executionTime: totalTime,
    iterationDetails: iterations,
    allExecutionResults,
    progressMessageId,
  };
}

/**
 * Formatea resultados para la IA de forma legible
 */
function formatResultsForAI(executionResults) {
  let text = "**EXECUTION RESULTS:**\n\n";

  if (executionResults.successCount > 0) {
    text += `✅ Successfully executed ${executionResults.successCount} action(s):\n\n`;

    executionResults.results.forEach((result, idx) => {
      text += `${idx + 1}. [${result.type}]\n`;

      if (result.type === "sql") {
        text += `   Operation: ${result.result.operation}\n`;
        text += `   Rows affected: ${result.result.rowCount}\n`;
        if (result.result.rows && result.result.rows.length > 0) {
          text += `   Data:\n`;
          text += `   ${JSON.stringify(result.result.rows, null, 2)}\n`;
        }
      } else if (result.type === "telegram") {
        text += `   Message sent/edited successfully\n`;
        text += `   Message ID: ${result.result.message_id}\n`;
      } else if (result.type === "memory") {
        text += `   Memory operation completed\n`;
      }

      text += `\n`;
    });
  }

  if (executionResults.errorCount > 0) {
    text += `\n❌ Errors (${executionResults.errorCount}):\n`;
    executionResults.errors.forEach((error, idx) => {
      text += `${idx + 1}. [${error.type}] ${error.error}\n`;
    });
  }

  return text;
}

/**
 * Pide a la IA que corrija un error con feedback
 */
async function askAIToFixError(
  systemPrompt,
  conversationHistory,
  failedResponse,
  feedbackText,
) {
  const errorPrompt = {
    role: "user",
    content: `${feedbackText}\n\nYour previous response had errors. Please review the feedback above and generate a CORRECTED response with the right schema/syntax. Learn from the error and fix it.`,
  };

  try {
    const response = await cerebras.chat.completions.create({
      model: "gpt-oss-120b",
      stream: false,
      messages: [systemPrompt, ...conversationHistory, errorPrompt],
    });

    return response.choices[0]?.message?.content || failedResponse;
  } catch (error) {
    console.error("Error asking AI to fix:", error);
    return failedResponse;
  }
}

/**
 * Pregunta a la IA por el siguiente paso después de ejecutar acciones
 */
async function askAIForNextStep(
  systemPrompt,
  conversationHistory,
  previousResponse,
  resultsText,
) {
  const nextStepPrompt = {
    role: "user",
    content: `${resultsText}\n\nYour actions were executed successfully. Based on the results above:
1. Generate a natural, conversational response for the user with the REAL data
2. If you need to perform additional actions (like sending a confirmation message), include them
3. If you're done, just provide the final message without any actions

**Remember:** You can use [ACTION:telegram] to send confirmation messages or updates to the user.`,
  };

  try {
    const response = await cerebras.chat.completions.create({
      model: "gpt-oss-120b",
      stream: false,
      messages: [systemPrompt, ...conversationHistory, nextStepPrompt],
    });

    return response.choices[0]?.message?.content || previousResponse;
  } catch (error) {
    console.error("Error asking AI for next step:", error);
    return previousResponse;
  }
}

/**
 * Genera un mensaje de espera personalizado con la IA
 */
async function generateWaitingMessage(
  systemPrompt,
  conversationHistory,
  initialResponse,
) {
  try {
    const waitingPrompt = {
      role: "user",
      content: `You MUST respond with ONLY the waiting message, nothing else. No explanations, no "Here's the message:", no quotes around it. Just the message itself.

Generate a SHORT, cute waiting message in Spanish with Moe personality (1-2 lines max). Use kaomojis. Examples:
- Un momentito mientras trabajo en esto~ (◕‿◕✿)
- Déjame revisar eso, senpai! (•̀ᴗ•́)و
- Procesando... ¡Dame un segundo! (◕ω◕)

Respond with ONLY the message:`,
    };

    const response = await cerebras.chat.completions.create({
      model: "gpt-oss-120b",
      stream: false,
      messages: [systemPrompt, waitingPrompt],
      max_tokens: 50,
    });

    let message =
      response.choices[0]?.message?.content || "⏳ Trabajando en ello...";

    // Limpiar el mensaje de formato extra común
    message = message.trim();

    // Remover comillas al inicio y final
    message = message.replace(/^["']|["']$/g, "");

    // Si empieza con explicación, extraer solo el mensaje entre comillas
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      message = quotedMatch[1];
    }

    // Si tiene formato "Aquí tienes..." o similar, intentar extraer solo la última línea
    if (message.includes("\n")) {
      const lines = message.split("\n").filter((line) => line.trim());
      // Buscar la línea que parece ser el mensaje (tiene kaomoji o emojis)
      const msgLine = lines.find((line) =>
        /[\(（][^\)）]*[\)）]|[~✨💫🌟]/.test(line),
      );
      if (msgLine) {
        message = msgLine.trim().replace(/^["']|["']$/g, "");
      } else {
        // Usar la última línea no vacía
        message = lines[lines.length - 1].trim().replace(/^["']|["']$/g, "");
      }
    }

    return message;
  } catch (error) {
    console.error("Error generating waiting message:", error);
    return "⏳ Trabajando en ello...";
  }
}

/**
 * Envía un mensaje de progreso al usuario
 */
async function sendProgressMessage(chatId, text) {
  try {
    const result = await sendMessage(chatId, text, "HTML");
    console.log(
      `📨 Sent progress message to ${chatId}: "${text.substring(0, 50)}..."`,
    );
    return result;
  } catch (error) {
    console.error("Error sending progress message:", error);
    return null;
  }
}

/**
 * Actualiza el mensaje de progreso
 */
async function updateProgressMessage(chatId, messageId, newText) {
  if (!messageId || !chatId || !CONFIG.SHOW_PROGRESS) {
    console.log("⚠️ Skipping progress update: missing messageId or chatId");
    return;
  }

  // Esperar un poco para no hacer spam de edits
  await new Promise((resolve) =>
    setTimeout(resolve, CONFIG.EDIT_PROGRESS_DELAY),
  );

  try {
    console.log(
      `📝 Updating progress message ${messageId} in chat ${chatId}: "${newText.substring(0, 50)}..."`,
    );
    await editMessageText(chatId, messageId, newText, "HTML");
    console.log(`✅ Progress message updated successfully`);
  } catch (error) {
    // Ignorar errores de edición (mensaje muy viejo, etc)
    console.log(
      `⚠️ Could not update progress message ${messageId}:`,
      error.message,
    );
  }
}

/**
 * Configuración del executor
 */
export function configureIterativeExecutor(options) {
  if (options.maxIterations !== undefined) {
    CONFIG.MAX_ITERATIONS = options.maxIterations;
  }
  if (options.iterationTimeout !== undefined) {
    CONFIG.ITERATION_TIMEOUT = options.iterationTimeout;
  }
  if (options.showProgress !== undefined) {
    CONFIG.SHOW_PROGRESS = options.showProgress;
  }
  if (options.editProgressDelay !== undefined) {
    CONFIG.EDIT_PROGRESS_DELAY = options.editProgressDelay;
  }

  console.log("✅ Iterative executor configured:", CONFIG);
}

/**
 * Health check del iterative executor
 */
export async function healthCheck() {
  return {
    status: "healthy",
    config: CONFIG,
    timestamp: new Date().toISOString(),
  };
}

export default {
  executeIteratively,
  configureIterativeExecutor,
  healthCheck,
};
