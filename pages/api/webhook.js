// pages/api/webhook.js
import { sendMessage, sendDice, deleteMessage, editMessageText } from "@/utils/telegram"; // Asumiendo que ahora están en utils/telegram.js
import * as TaskManager from "@/lib/services/taskManager"; // Nueva ruta
import * as MoeHandler from "@/lib/services/moeHandler";   // Nueva ruta

// Comandos que ya tenías (asegúrate de que importen sendMessage con parse_mode si es necesario)
import { cricketCommand } from "@/utils/commands/cricket"; // Mantén tus comandos existentes
import { helpCommand } from "@/utils/commands/help";
import { pingCommand } from "@/utils/commands/ping";

export const config = {
  maxDuration: 60, // Buen ajuste para funciones que pueden hacer múltiples llamadas API
};

// Helper para esperar
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader('Allow', ['POST']);
    return res.status(405).send('Method Not Allowed');
  }

  // Validar que el body y message existen
  if (!req.body || !req.body.message) {
    console.warn("Webhook: Solicitud inválida o sin cuerpo de mensaje.");
    return res.status(400).send("Bad Request: Missing message body");
  }

  const chatId = req.body.message.chat.id;
  const text = req.body.message.text || ""; // Asegurar que text no sea undefined
  const userId = req.body.message.from.id;

  console.log(`Webhook: ChatID=${chatId}, UserID=${userId}, Text="${text}"`);

  try {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await helpCommand(chatId); // Asume que helpCommand usa tu sendMessage con parse_mode
    }
    else if (text.startsWith("/ping")) {
      await pingCommand(chatId);
    }
    else if (text.startsWith("/cricket")) {
      await cricketCommand(chatId);
    }
    // --- Nuevos Comandos de MoeTasker ---
    else if (text.startsWith("/frase") || text.startsWith("/relax")) {
      const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
      await sendMessage(chatId, `${phrase} ${kaomoji}`, "MarkdownV2");
    }
    else if (text.startsWith("/asignar")) {
      const argsText = text.substring("/asignar".length).trim();
      if (!argsText) {
        await sendMessage(chatId, "Por favor, proporciona las tareas después del comando. Ejemplo: `/asignar Tarea A, Tarea B`", "MarkdownV2");
      } else {
        const taskDescriptions = argsText.split(',').map(desc => desc.trim()).filter(Boolean);
        if (!taskDescriptions.length) {
          await sendMessage(chatId, "Debes proporcionar al menos una descripción de tarea válida.", "MarkdownV2");
        } else {
          const initialMsgResponse = await sendMessage(chatId, "🎲 Iniciando asignación de tareas...");
          const initialMsgId = initialMsgResponse && initialMsgResponse.ok ? (await initialMsgResponse.json()).result.message_id : null;
          
          const diceResponse = await sendDice(chatId);
          const diceMsgId = diceResponse ? diceResponse.result.message_id : null;

          await delay(3500); // Esperar animación del dado

          // Opcional: Editar mensaje
          // if (initialMsgId) await editMessageText(chatId, initialMsgId, "⚙️ Procesando...");
          // await delay(1000);

          const result = await TaskManager.assignTasks(chatId, taskDescriptions);
          
          // Borrar mensajes intermedios
          if (initialMsgId) await deleteMessage(chatId, initialMsgId);
          if (diceMsgId) await deleteMessage(chatId, diceMsgId);
          
          await sendMessage(chatId, result.message, "MarkdownV2");
        }
      }
    }
    else if (text.startsWith("/tareas")) {
      const summary = await TaskManager.getPendingTasksSummary();
      await sendMessage(chatId, summary, "MarkdownV2");
    }
    // Para /completar ID y /completar_ID
    else if (text.startsWith("/completar")) {
      const matchWithSpace = text.match(/^\/completar\s+(\w+)/);
      const matchWithUnderscore = text.match(/^\/completar_(\w+)/);
      const taskId = matchWithSpace ? matchWithSpace[1] : (matchWithUnderscore ? matchWithUnderscore[1] : null);

      if (!taskId) {
        await sendMessage(chatId, "Por favor, proporciona el ID de la tarea. Ejemplo: `/completar_abcdef12`", "MarkdownV2");
      } else {
        const responseMsg = await TaskManager.completeTask(taskId, userId);
        await sendMessage(chatId, responseMsg, "MarkdownV2");
      }
    }
    // --- Fin Nuevos Comandos ---
    else {
      // Manejo de texto para Moe (si no es comando)
      const moeResponse = MoeHandler.getMoeResponse(text);
      if (moeResponse) {
        await sendMessage(chatId, moeResponse, "MarkdownV2");
      } else {
        // Si no es ningún comando conocido ni trigger moe, podrías responder con un "no entiendo"
        // o simplemente no hacer nada, o llamar a tu sendMessage(chatId, text) original como fallback.
        // Por ahora, si no es nada, no haremos nada para evitar eco.
        // await sendMessage(chatId, `No entendí: "${text}"`);
        console.log("Webhook: Texto no reconocido como comando o trigger moe.");
      }
    }
    res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook Error:", error);
    // Evitar enviar detalles del error al cliente/Telegram
    res.status(500).send("Internal Server Error");
  }
}