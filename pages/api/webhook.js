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
  if (!req.body || !req.body.message) {
    console.warn("Webhook: Solicitud inválida o sin cuerpo de mensaje.");
    return res.status(400).send("Bad Request: Missing message body");
  }
  const message = req.body.message || req.body.edited_message || req.body.channel_post || req.body.edited_channel_post;
  if (message && message.new_chat_members && message.new_chat_members.length > 0) {
    const chatId = message.chat.id;
    for (const member of message.new_chat_members) {
      if (!member.is_bot) { // No dar bienvenida a otros bots
        const memberName = member.first_name || "nuevo miembro";
        // Usar mention helper si lo tienes en htmlEscaper.js
        // import { mention } from '@/lib/utils/htmlEscaper';
        // const userMention = mention(memberName, member.id);
        // O construirlo manualmente:
        const userMention = `<a href="tg://user?id=${member.id}">${escapeHTML(memberName)}</a>`;
        
        const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
        const welcomeMessage = 
          `¡Bienvenid@ al equipo, ${userMention}! 🎉 ${escapeHTML(kaomoji)}\n\n` +
          `Soy MoeTasker, tu asistente para la gestión de tareas del proyecto. ` +
          `Puedes usar ${code('/help')} para ver lo que puedo hacer.\n\n` +
          `<i>"${phrase}"</i>`;
        await sendMessage(chatId, welcomeMessage, "HTML");
      }
    }
    // Importante: Si un mensaje de "nuevo miembro" también contiene texto de comando,
    // podríamos querer detener el procesamiento aquí o permitir que continúe.
    // Por ahora, si es un mensaje de nuevo miembro, respondemos y terminamos.
    return res.status(200).send("OK"); 
  }
  if (!message || !message.chat || !message.from) {
    console.warn("Webhook: Mensaje o campos esenciales faltantes.");
    return res.status(200).send("OK"); // Responder OK a Telegram para evitar reintentos
  }

  const chatId = message.chat.id;
  const text = message.text || "";
  const userId = message.from.id;
  const userFirstName = message.from.first_name || "Usuario";
  console.log(`Webhook: ChatID=${chatId}, UserID=${userId}, Text="${text}"`);

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