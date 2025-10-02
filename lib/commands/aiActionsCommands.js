// lib/commands/aiActionsCommands.js

/**
 * Comandos relacionados con el sistema AI Actions
 * Documentación, testing y configuración de acciones autónomas de la IA
 */

import { sendMessage } from "@/utils/telegram";
import { escapeMarkdownV2 } from "@/lib/services/moeHandler";
import {
  getActionDocumentation,
  getSecurityInfo,
  healthCheck,
  validateActionsInText,
} from "@/lib/ai";
import { query } from "@/lib/db";

/**
 * /aiactions - Muestra documentación del sistema AI Actions
 */
export async function aiActionsCommand(chatId, args, context = {}) {
  try {
    const documentation = getActionDocumentation();

    // Dividir en partes si es muy largo
    const maxLength = 4000;
    const parts = [];
    let currentPart = "";

    documentation.split("\n").forEach((line) => {
      if ((currentPart + line + "\n").length > maxLength) {
        parts.push(currentPart);
        currentPart = line + "\n";
      } else {
        currentPart += line + "\n";
      }
    });

    if (currentPart) {
      parts.push(currentPart);
    }

    // Enviar cada parte
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const header =
        i === 0
          ? ""
          : `📖 Documentación AI Actions (${i + 1}/${parts.length})\n\n`;
      await sendMessage(chatId, header + escapeMarkdownV2(part), "MarkdownV2");
    }

    return {
      success: true,
      reply: "✅ Documentación enviada",
    };
  } catch (error) {
    console.error("Error in aiActionsCommand:", error);
    return {
      success: false,
      reply: `❌ Error mostrando documentación: ${error.message}`,
    };
  }
}

/**
 * /aistatus - Muestra el estado del sistema AI Actions
 */
export async function aiStatusCommand(chatId, args, context = {}) {
  try {
    const health = await healthCheck();
    const securityInfo = getSecurityInfo();

    let statusMessage = `🤖 *Estado del Sistema AI Actions*\n\n`;
    statusMessage += `📊 *Estado:* ${health.status === "healthy" ? "✅ Saludable" : "⚠️ Con problemas"}\n`;
    statusMessage += `⏰ *Timestamp:* ${new Date(health.timestamp).toLocaleString("es-ES")}\n\n`;

    statusMessage += `🔧 *Capacidades:*\n`;
    statusMessage += `   • SQL: ${health.capabilities.sql ? "✅" : "❌"}\n`;
    statusMessage += `   • Telegram: ${health.capabilities.telegram ? "✅" : "❌"}\n`;
    statusMessage += `   • Memory: ${health.capabilities.memory ? "✅" : "❌"}\n\n`;

    statusMessage += `🛡️ *Seguridad:*\n`;
    statusMessage += `   • Tablas permitidas: ${health.security.allowedTables}\n`;
    statusMessage += `   • Operaciones permitidas: ${health.security.allowedOperations}\n`;
    statusMessage += `   • Límite SELECT: ${health.security.limits.MAX_RESULTS} rows\n`;
    statusMessage += `   • Límite UPDATE/DELETE: ${health.security.limits.MAX_AFFECTED_ROWS} rows\n`;
    statusMessage += `   • Timeout: ${health.security.limits.QUERY_TIMEOUT}ms\n\n`;

    statusMessage += `📦 *Versión:* ${health.version}`;

    await sendMessage(chatId, escapeMarkdownV2(statusMessage), "MarkdownV2");

    return {
      success: true,
      reply: "✅ Estado enviado",
    };
  } catch (error) {
    console.error("Error in aiStatusCommand:", error);
    return {
      success: false,
      reply: `❌ Error obteniendo estado: ${error.message}`,
    };
  }
}

/**
 * /aitables - Muestra las tablas permitidas para AI Actions
 */
export async function aiTablesCommand(chatId, args, context = {}) {
  try {
    const securityInfo = getSecurityInfo();

    let message = `🗄️ *Tablas Permitidas para AI Actions*\n\n`;
    message += `La IA puede acceder a estas ${securityInfo.allowedTables.length} tablas:\n\n`;

    for (const table of securityInfo.allowedTables) {
      message += `• \`${table}\`\n`;

      // Agregar descripción de la tabla
      switch (table) {
        case "tasks":
          message += `  _Gestión de tareas del equipo_\n`;
          break;
        case "team_members":
          message += `  _Miembros del equipo_\n`;
          break;
        case "oracle_memories":
          message += `  _Memorias del Oráculo_\n`;
          break;
        case "stickers":
          message += `  _Catálogo de stickers_\n`;
          break;
        case "work_documents":
          message += `  _Documentos de trabajo_\n`;
          break;
        case "group_config":
          message += `  _Configuración por grupo_\n`;
          break;
        case "ai_memory":
          message += `  _Memoria persistente de la IA_\n`;
          break;
      }
    }

    message += `\n⚠️ *Importante:* Todas las consultas deben incluir \`WHERE chat_id = $1\` para respetar multi-tenancy.`;

    await sendMessage(chatId, escapeMarkdownV2(message), "MarkdownV2");

    return {
      success: true,
      reply: "✅ Tablas listadas",
    };
  } catch (error) {
    console.error("Error in aiTablesCommand:", error);
    return {
      success: false,
      reply: `❌ Error listando tablas: ${error.message}`,
    };
  }
}

/**
 * /aimemory - Muestra la memoria persistente de la IA para este grupo
 */
export async function aiMemoryCommand(chatId, args, context = {}) {
  try {
    const action = args[0]?.toLowerCase() || "list";

    if (action === "list") {
      // Listar todas las memorias
      const result = await query(
        `SELECT key, value, created_at, updated_at
         FROM ai_memory
         WHERE chat_id = $1
         ORDER BY updated_at DESC
         LIMIT 20`,
        [chatId],
      );

      if (result.rows.length === 0) {
        return {
          success: true,
          reply: "🧠 La IA no tiene memorias guardadas aún para este grupo.",
        };
      }

      let message = `🧠 *Memoria de la IA* (${result.rows.length} items)\n\n`;

      for (const row of result.rows) {
        const value =
          typeof row.value === "object"
            ? JSON.stringify(row.value).substring(0, 50) + "..."
            : String(row.value).substring(0, 50);

        message += `📝 *${row.key}*\n`;
        message += `   Valor: \`${value}\`\n`;
        message += `   Actualizado: ${new Date(row.updated_at).toLocaleString("es-ES")}\n\n`;
      }

      message += `_Usa /aimemory clear para limpiar todas las memorias_`;

      await sendMessage(chatId, escapeMarkdownV2(message), "MarkdownV2");

      return {
        success: true,
        reply: "✅ Memoria listada",
      };
    } else if (action === "clear") {
      // Limpiar todas las memorias
      const result = await query(`DELETE FROM ai_memory WHERE chat_id = $1`, [
        chatId,
      ]);

      return {
        success: true,
        reply: `🧠 Se eliminaron ${result.rowCount} memoria(s) de la IA.`,
      };
    } else if (action === "get" && args[1]) {
      // Obtener una memoria específica
      const key = args[1];
      const result = await query(
        `SELECT * FROM ai_memory WHERE chat_id = $1 AND key = $2`,
        [chatId, key],
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          reply: `❌ No se encontró la memoria con clave "${key}"`,
        };
      }

      const memory = result.rows[0];
      const valueStr =
        typeof memory.value === "object"
          ? JSON.stringify(memory.value, null, 2)
          : String(memory.value);

      let message = `🧠 *Memoria: ${key}*\n\n`;
      message += `\`\`\`json\n${valueStr}\n\`\`\`\n\n`;
      message += `Creado: ${new Date(memory.created_at).toLocaleString("es-ES")}\n`;
      message += `Actualizado: ${new Date(memory.updated_at).toLocaleString("es-ES")}`;

      await sendMessage(chatId, escapeMarkdownV2(message), "MarkdownV2");

      return {
        success: true,
        reply: "✅ Memoria obtenida",
      };
    } else {
      return {
        success: false,
        reply: `Uso: /aimemory [list|clear|get <key>]`,
      };
    }
  } catch (error) {
    console.error("Error in aiMemoryCommand:", error);
    return {
      success: false,
      reply: `❌ Error con memoria: ${error.message}`,
    };
  }
}

/**
 * /aitest - Prueba el sistema de parsing de acciones (no ejecuta)
 */
export async function aiTestCommand(chatId, args, context = {}) {
  try {
    const testText = args.join(" ");

    if (!testText) {
      return {
        success: false,
        reply: `❌ Uso: /aitest <texto con acciones>\n\nEjemplo:\n/aitest Hola! [ACTION:sql]{"query": "SELECT * FROM tasks WHERE chat_id = $1", "params": [123]}[/ACTION]`,
      };
    }

    const validation = validateActionsInText(testText);

    let message = `🧪 *Test de AI Actions*\n\n`;
    message += `📊 *Resultado del Parsing:*\n`;
    message += `   • Tiene acciones: ${validation.hasActions ? "✅ Sí" : "❌ No"}\n`;
    message += `   • Acciones válidas: ${validation.validCount}\n`;
    message += `   • Acciones inválidas: ${validation.invalidCount}\n\n`;

    if (validation.validCount > 0) {
      message += `✅ *Acciones Válidas:*\n`;
      validation.actions.forEach((action, idx) => {
        message += `${idx + 1}. [${action.type}]\n`;
        message += `   \`${JSON.stringify(action.data).substring(0, 100)}\`\n`;
      });
      message += `\n`;
    }

    if (validation.invalidCount > 0) {
      message += `❌ *Acciones Inválidas:*\n`;
      validation.invalidActions.forEach((action, idx) => {
        message += `${idx + 1}. [${action.type || "unknown"}]\n`;
        message += `   Error: ${action.validationError || action.error}\n`;
      });
      message += `\n`;
    }

    if (validation.message) {
      message += `💬 *Mensaje limpio:*\n${validation.message.substring(0, 200)}`;
    }

    await sendMessage(chatId, escapeMarkdownV2(message), "MarkdownV2");

    return {
      success: true,
      reply: "✅ Test completado",
    };
  } catch (error) {
    console.error("Error in aiTestCommand:", error);
    return {
      success: false,
      reply: `❌ Error en test: ${error.message}`,
    };
  }
}

/**
 * Registra todos los comandos de AI Actions
 */
export function registerAIActionsCommands(registerCommand) {
  registerCommand({
    name: "aiactions",
    description: "📚 Muestra la documentación completa del sistema AI Actions",
    parameters: [],
    handler: async (context, params) => {
      const result = await aiActionsCommand(
        context.chatId,
        params.args || [],
        context,
      );
      return result;
    },
    aliases: ["aidocs", "aihelp"],
    category: "ai",
    requiresAdmin: false,
    example: "/aiactions",
  });

  registerCommand({
    name: "aistatus",
    description: "🤖 Muestra el estado y capacidades del sistema AI Actions",
    parameters: [],
    handler: async (context, params) => {
      const result = await aiStatusCommand(
        context.chatId,
        params.args || [],
        context,
      );
      return result;
    },
    aliases: ["aihealth"],
    category: "ai",
    requiresAdmin: false,
    example: "/aistatus",
  });

  registerCommand({
    name: "aitables",
    description: "🗄️ Lista las tablas de base de datos accesibles por la IA",
    parameters: [],
    handler: async (context, params) => {
      const result = await aiTablesCommand(
        context.chatId,
        params.args || [],
        context,
      );
      return result;
    },
    aliases: ["aidb"],
    category: "ai",
    requiresAdmin: false,
    example: "/aitables",
  });

  registerCommand({
    name: "aimemory",
    description:
      "🧠 Gestiona la memoria persistente de la IA (list, clear, get)",
    parameters: [
      {
        name: "action",
        type: "string",
        required: false,
        description: "Action: list, clear, or get <key>",
      },
    ],
    handler: async (context, params) => {
      const args = params.args
        ? Array.isArray(params.args)
          ? params.args
          : params.args.split(" ")
        : [];
      const result = await aiMemoryCommand(context.chatId, args, context);
      return result;
    },
    aliases: ["aimem"],
    category: "ai",
    requiresAdmin: false,
    example: "/aimemory list",
  });

  registerCommand({
    name: "aitest",
    description: "🧪 Prueba el parsing de acciones sin ejecutarlas",
    parameters: [
      {
        name: "text",
        type: "string",
        required: true,
        description: "Texto con acciones a validar",
      },
    ],
    handler: async (context, params) => {
      const args = params.args
        ? Array.isArray(params.args)
          ? params.args
          : [params.args]
        : [];
      const result = await aiTestCommand(context.chatId, args, context);
      return result;
    },
    aliases: [],
    category: "ai",
    requiresAdmin: true,
    example:
      '/aitest Hola! [ACTION:sql]{"query": "SELECT * FROM tasks"}[/ACTION]',
  });
}

export default {
  aiActionsCommand,
  aiStatusCommand,
  aiTablesCommand,
  aiMemoryCommand,
  aiTestCommand,
  registerAIActionsCommands,
};
