// pages/api/webhook.js
import { sendMessage, sendDice, deleteMessage, editMessageText } from "@/utils/telegram"; // Asumiendo que ahora están en utils/telegram.js
import * as TaskManager from "@/lib/services/taskManager"; // Nueva ruta
import * as MoeHandler from "@/lib/services/moeHandler";   // Nueva ruta
import { escapeHTML, bold, italic, code } from '@/lib/utils/htmlEscaper';

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
  const update = req.body; // El objeto update completo de Telegram

  // Extraer el objeto 'message' o el relevante para el update
  let messageObject = update.message || 
                      update.edited_message || 
                      update.channel_post || 
                      update.edited_channel_post;
  

  // Para callback_query, el 'message' está anidado de forma diferente
  let callbackQueryData = null;
  let userFromCallback = null;
  if (update.callback_query) {
    messageObject = update.callback_query.message; // El mensaje al que estaba adjunto el botón
    callbackQueryData = update.callback_query.data;
    userFromCallback = update.callback_query.from;
    console.log("Webhook: Es un callback_query. Data:", callbackQueryData);
    // Aquí manejarías la lógica de los botones inline y responderías con answerCallbackQuery
    // await bot.telegram.answerCallbackQuery(update.callback_query.id); // Ejemplo con Telegraf/Aiogram
    // Con tu fetch manual, necesitarías llamar al método answerCallbackQuery de la API
    // Por ahora, simplemente respondemos OK para este ejemplo
    return res.status(200).send("OK");
  }

  if (!messageObject) {
    console.warn("Webhook: No se pudo extraer un objeto de mensaje procesable del update.", update);
    return res.status(200).send("OK"); // Aceptar el update para evitar reintentos
  }

  // Manejo de nuevos miembros
  if (messageObject.new_chat_members && messageObject.new_chat_members.length > 0) {
    const chatId = messageObject.chat.id;
    // ... (tu lógica de bienvenida igual, usando messageObject.new_chat_members y messageObject.chat.id) ...
    return res.status(200).send("OK"); 
  }

  const chatId = messageObject.chat.id;
  let text = messageObject.text || "";
  const userId = messageObject.from.id;
  const userFirstName = messageObject.from.first_name || "Usuario";

  // Limpiar el @NombreDeTuBot de los comandos en grupos
  if (messageObject.chat.type === "group" || messageObject.chat.type === "supergroup") {
    const botUsername = process.env.BOT_USERNAME; // Necesitarás añadir BOT_USERNAME a tus .env
    if (botUsername && text.includes(`@${botUsername}`)) {
      text = text.replace(`@${botUsername}`, "").trim();
    }
  }

  console.log(`Webhook Procesado: ChatID=${chatId}, UserID=${userId}, Text="${text}"`);
  
  try {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const helpText = MoeHandler.getHelpMessage(userFirstName);
      await sendMessage(chatId, helpText, "HTML");
    }
    // --- Nuevos Comandos de MoeTasker ---
    else if (text.startsWith("/frase") || text.startsWith("/relax")) {
      const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
      await sendMessage(chatId, `${phrase} ${kaomoji}`, "HTML");
    }
    else if (text.startsWith("/asignar")) {
      const argsText = text.substring("/asignar".length).trim();
      if (!argsText) {
        await sendMessage(chatId, "Por favor, proporciona las tareas después del comando. Ejemplo: `/asignar Tarea A, Tarea B`", "HTML");
      } else {
        const taskDescriptions = argsText.split(',').map(desc => desc.trim()).filter(Boolean);
        if (!taskDescriptions.length) {
          await sendMessage(chatId, "Debes proporcionar al menos una descripción de tarea válida.", "HTML");
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
          
          await sendMessage(chatId, result.message, "HTML");
        }
      }
    }
    else if (text.startsWith("/tareas")) {
      const summary = await TaskManager.getPendingTasksSummary();
      await sendMessage(chatId, summary, "HTML");
    }
    else if (text.startsWith("/clear_tasks")) {
      const summary = ``;
      if (TaskManager.clear_tasks()){
        summary = `Todas las tareas eliminadas.` + escapeHTML(MoeHandler.getRandomFunPhrase().kaomoji);
      }
      else{
        summary = `Ocurrió un error al eliminar las tareas` + escapeHTML(MoeHandler.getRandomFunPhrase().kaomoji);
      }

      await sendMessage(chatId, summary, "HTML");
    }
    // Para /completar ID y /completar_ID
    else if (text.startsWith("/completar")) {
      const matchWithSpace = text.match(/^\/completar\s+(\w+)/);
      const matchWithUnderscore = text.match(/^\/completar_(\w+)/);
      const taskId = matchWithSpace ? matchWithSpace[1] : (matchWithUnderscore ? matchWithUnderscore[1] : null);

      if (!taskId) {
        await sendMessage(chatId, "Por favor, proporciona el ID de la tarea. Ejemplo: `/completar_abcdef12`", "HTML");
      } else {
        const responseMsg = await TaskManager.completeTask(taskId, userId);
        await sendMessage(chatId, responseMsg, "HTML");
      }
    }
    // --- Fin Nuevos Comandos ---
    else {
      // Manejo de texto para Moe (si no es comando)
      const moeResponse = MoeHandler.getMoeResponse(text);
      if (moeResponse) {
        await sendMessage(chatId, moeResponse, "HTML");
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