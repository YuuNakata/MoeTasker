// lib/middleware/commandHandler.js
import {
  parseCommand,
  executeCommand,
  getCommand,
} from "@/lib/services/commandRegistry";
import { sendMessage } from "@/utils/telegram";
import { getRandomKaomoji } from "@/lib/services/moeHandler";

export async function handleDirectCommand(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;
  const text = message.text || "";

  if (!text.startsWith("/")) {
    return null;
  }

  const parsed = parseCommand(text);

  if (!parsed) {
    await sendMessage(
      chatId,
      `Hmm... no conozco ese comando. ${getRandomKaomoji()}\n\nUsa /help para ver los comandos disponibles.`,
      "HTML",
    );
    return { handled: true, success: false };
  }

  const context = {
    chatId,
    userId,
    username,
    message,
  };

  const params = {
    args: parsed.rawArgs,
  };

  try {
    console.log(`📝 Direct command: /${parsed.name} by user ${userId}`);
    const result = await executeCommand(parsed.name, context, params);

    return {
      handled: true,
      success: result.success,
      result: result,
    };
  } catch (error) {
    console.error(`Error executing command /${parsed.name}:`, error);

    await sendMessage(
      chatId,
      `Oops! Algo salió mal ejecutando el comando. ${getRandomKaomoji()}\n\nError: ${error.message}`,
      "HTML",
    );

    return {
      handled: true,
      success: false,
      error: error.message,
    };
  }
}

export async function detectCommandIntent(text, chatId, message) {
  const lowerText = text.toLowerCase();

  const intentPatterns = [
    {
      patterns: [
        /(?:agrega|añade|add|agregar|añadir)\s+(?:a\s+)?@(\w+)\s+(?:al\s+)?(?:equipo|team|grupo|group)/i,
      ],
      command: "addMember",
      extractParams: (match) => {
        return { args: match[1] ? `@${match[1]}` : "" };
      },
      validate: (match, message) => {
        // Solo ejecutar si hay un @username válido
        return match[1] && match[0].includes("@");
      },
    },
    {
      patterns: [
        /(?:asigna|assign|distribuye|distribute).*?(?:tareas|tasks|trabajo|work)[:\s]+(.+)/i,
        /(?:crea|create).*?(?:tareas|tasks)[:\s]+(.+)/i,
      ],
      command: "assign",
      extractParams: (match) => {
        return { tasks: match[1] ? match[1].trim() : "" };
      },
    },
    {
      patterns: [
        /(?:muestra|show|lista|list).*?(?:tareas|tasks|pendientes|pending)/i,
      ],
      command: "tasks",
      extractParams: () => ({}),
    },
    {
      patterns: [
        /(?:lista|muestra|show|list).*?(?:miembros|members|equipo|team)/i,
      ],
      command: "listMembers",
      extractParams: () => ({}),
    },
  ];

  for (const intent of intentPatterns) {
    for (const pattern of intent.patterns) {
      const match = text.match(pattern);
      if (match) {
        // Validar si el comando puede ejecutarse con este contexto
        if (intent.validate && !intent.validate(match, message)) {
          console.log(
            `⚠️ Intent detected but validation failed: /${intent.command}`,
          );
          continue;
        }

        const command = getCommand(intent.command);
        if (command) {
          const params = intent.extractParams(match);
          console.log(
            `🎯 Intent detected: /${intent.command}`,
            "params:",
            params,
          );
          return {
            command: intent.command,
            params,
            confidence: "high",
          };
        }
      }
    }
  }

  return null;
}

export async function handleAIDetectedCommand(message, detectedIntent) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;

  const context = {
    chatId,
    userId,
    username,
    message,
  };

  try {
    console.log(`🤖 AI executing detected command: /${detectedIntent.command}`);

    const result = await executeCommand(
      detectedIntent.command,
      context,
      detectedIntent.params,
    );

    return {
      handled: true,
      success: result.success,
      result: result,
      wasAIDetected: true,
    };
  } catch (error) {
    console.error(
      `Error executing AI-detected command /${detectedIntent.command}:`,
      error,
    );

    await sendMessage(
      chatId,
      `Oops! Intenté hacerlo pero algo salió mal. ${getRandomKaomoji()}\n\nError: ${error.message}`,
      "HTML",
    );

    return {
      handled: true,
      success: false,
      error: error.message,
      wasAIDetected: true,
    };
  }
}

export async function processCommand(message) {
  const text = message.text || "";

  if (text.startsWith("/")) {
    const result = await handleDirectCommand(message);
    if (result) {
      return result;
    }
  }

  const detectedIntent = await detectCommandIntent(
    text,
    message.chat.id,
    message,
  );

  if (detectedIntent) {
    const result = await handleAIDetectedCommand(message, detectedIntent);
    return result;
  }

  return { handled: false };
}

export async function isCommand(text) {
  if (!text) return false;

  if (text.startsWith("/")) {
    return true;
  }

  const intent = await detectCommandIntent(text, null, null);
  return intent !== null;
}
