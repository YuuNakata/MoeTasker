// pages/api/webhook.js
import { sendMessage, sendDice, deleteMessage, editMessageText, forwardMessage, sendDocumentByFileId, sendSticker, answerCallbackQuery } from "@/utils/telegram";
import * as TaskManager from "@/lib/services/taskManager";
import * as MoeHandler from "@/lib/services/moeHandler";
import * as OracleManager from "@/lib/services/oracleManager";
import { escapeHTML, bold, italic, code } from '@/lib/utils/htmlEscaper';

export const config = {
  maxDuration: 60,
};

const TASK_TRIGGER_KEYWORDS = [
  "hay que", "necesitamos", "deberíamos", "deberia", "pendiente",
  "tengo que", "tenemos que", "falta hacer", "recordar hacer",
  "no olvidar", "sería bueno", "estaria bien", "investigar sobre",
  "revisar el", "arreglar el", "implementar el", "crear un",
  "añadir un", "terminar el", "optimizar el"
];
const NEGATION_KEYWORDS = ["no", "nunca", "tampoco"];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader('Allow', ['POST']);
    return res.status(405).send('Method Not Allowed');
  }
  
  const update = req.body;

  let messageObject = update.message || 
                      update.edited_message || 
                      update.channel_post || 
                      update.edited_channel_post;
  
  if (update.callback_query) {
    const cq = update.callback_query;
    messageObject = cq.message;
    const callbackQueryData = cq.data;
    const userFromCallback = cq.from;
    const originalChatId = messageObject.chat.id;
    const originalMessageId = messageObject.message_id;

    console.log("Webhook: CallbackQuery. Data:", callbackQueryData, "UserID:", userFromCallback.id);

    try {
      if (callbackQueryData.startsWith("create_task_confirm:")) {
        const encodedTaskDesc = callbackQueryData.split(":")[1];
        const taskDescription = decodeURIComponent(encodedTaskDesc);
        
        const result = await TaskManager.assignTasks(originalChatId, [taskDescription]);
        let confirmationText = `¡Entendido! ${MoeHandler.getRandomKaomoji()} He creado la tareíta: "${escapeHTML(taskDescription)}".`;
        if (result.message && result.message.includes("Asignada a:")) {
            confirmationText += `\n${result.message}`;
        }

        await editMessageText(
          originalChatId,
          originalMessageId,
          confirmationText.trim(),
          "HTML",
          null // Quitar teclado
        );
        await answerCallbackQuery(cq.id, { text: "¡Tarea creada! ✨" });

      } else if (callbackQueryData === "create_task_cancel") {
        await editMessageText(
          originalChatId,
          originalMessageId,
          `¡De acuerdo, sempai! ${MoeHandler.getRandomKaomoji()} No crearé la tarea esta vez. Si cambias de opinión, ¡ya sabes dónde encontrarme!`,
          "HTML",
          null // Quitar teclado
        );
        await answerCallbackQuery(cq.id, { text: "Cancelado ( ´ ∀ ` )ﾉ" });
      }
      // Aquí irían otros manejadores de callback_query futuros
    } catch (error) {
        console.error("Error procesando callback_query:", error);
        await answerCallbackQuery(cq.id, { text: "¡Ups! Algo salió mal (つω`｡)" });
    }
    return res.status(200).send("OK");
  }

  if (!messageObject) {
    console.warn("Webhook: No se pudo extraer un objeto de mensaje procesable del update.", update);
    return res.status(200).send("OK");
  }

  if (messageObject.new_chat_members && messageObject.new_chat_members.length > 0) {
    const chatId = messageObject.chat.id;
    for (const member of messageObject.new_chat_members) {
        if (member.is_bot && member.username === process.env.BOT_USERNAME) {
          await sendMessage(chatId, `¡Konichiwa minna-san! (≧◡≦) Soy ${process.env.BOT_NAME || 'su nueva amiga bot'}, ¡lista para ayudarles con el proyecto! Usen ${code("/help")} para ver mis poderes~ ✨`);
        } else if (!member.is_bot) {
          await sendMessage(chatId, `¡Bienvenido/a al equipo, ${escapeHTML(member.first_name)}-san! ${MoeHandler.getRandomKaomoji()} ¡Espero que trabajemos súper bien juntos!`);
        }
      }
    return res.status(200).send("OK"); 
  }

  if (messageObject.reply_to_message && 
    messageObject.reply_to_message.from && 
    messageObject.reply_to_message.from.is_bot &&
    messageObject.reply_to_message.from.username === process.env.BOT_USERNAME) {
  
    const stickerFileId = MoeHandler.getRandomReplySticker();
    if (stickerFileId) {
      try {
        await sendSticker(messageObject.chat.id, stickerFileId);
      } catch (e) {
        console.error("Webhook: Error al enviar sticker de respuesta:", e);
      }
    }
    return res.status(200).send("OK");
  }

  const chatId = messageObject.chat.id;
  let text = messageObject.text || "";
  const userId = messageObject.from.id;
  const userFirstName = messageObject.from.first_name || "Usuario";

  if (messageObject.chat.type === "group" || messageObject.chat.type === "supergroup") {
    const botUsername = process.env.BOT_USERNAME;
    if (botUsername && text.startsWith(`@${botUsername}`)) {
      text = text.replace(`@${botUsername}`, "").trim();
    }
  }

  console.log(`Webhook Procesado: ChatID=${chatId}, UserID=${userId}, Text="${text}"`);
  let commandProcessed = false;
  let suggestionProcessed = false;

  try {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const helpText = MoeHandler.getHelpMessage(userFirstName);
      await sendMessage(chatId, helpText, "HTML");
      commandProcessed = true;
    }
    else if (text.startsWith("/frase") || text.startsWith("/relax")) {
      const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
      await sendMessage(chatId, `${phrase} ${kaomoji}`, "HTML");
      commandProcessed = true;
    }
    else if (text.startsWith("/asignar")) {
      const argsText = text.substring("/asignar".length).trim();
      if (!argsText) {
        await sendMessage(chatId, `Por favor, proporciona las tareas después del comando. Ejemplo: ${code("/asignar Tarea A, Tarea B")} ${MoeHandler.getRandomKaomoji()}`, "HTML");
      } else {
        const taskDescriptions = argsText.split(',').map(desc => desc.trim()).filter(Boolean);
        if (!taskDescriptions.length) {
          await sendMessage(chatId, `Debes proporcionar al menos una descripción de tarea válida, ¿siii? ${MoeHandler.getRandomKaomoji()}`, "HTML");
        } else {
          const initialMsgResponse = await sendMessage(chatId, `🎲 ¡A la cargaaa! Asignando tareitas... ${MoeHandler.getRandomKaomoji()}`);
          let initialMsgId = null;
          if (initialMsgResponse && initialMsgResponse.ok) {
            const initialMsgData = await initialMsgResponse.json();
            initialMsgId = initialMsgData.result.message_id;
          }
          
          const diceApiResponse = await sendDice(chatId);
          const diceMsgId = diceApiResponse ? diceApiResponse.result.message_id : null;

          await delay(3500);
          
          if (initialMsgId) await editMessageText(chatId, initialMsgId, `⚙️ Procesando con mucho amor... ${MoeHandler.getRandomKaomoji()}`);
          await delay(1000);

          const result = await TaskManager.assignTasks(chatId, taskDescriptions);
          
          if (initialMsgId) await deleteMessage(chatId, initialMsgId);
          if (diceMsgId) await deleteMessage(chatId, diceMsgId);
          
          await sendMessage(chatId, result.message, "HTML");
        }
      }
      commandProcessed = true;
    }
    else if (text.startsWith("/tareas")) {
      const summary = await TaskManager.getPendingTasksSummary();
      await sendMessage(chatId, summary, "HTML");
      commandProcessed = true;
    }
    else if (text.startsWith("/clear_tasks")) {
      let summaryMsg = ``;
      const cleared = await TaskManager.clear_tasks();
      if (cleared){
        summaryMsg = `¡Todas las tareas han desaparecido! ¡Puf! ✨ ${MoeHandler.getRandomKaomoji()}`;
      } else {
        summaryMsg = `Uups, no pude borrar las tareas esta vez... ${MoeHandler.getRandomKaomoji()}`;
      }
      await sendMessage(chatId, summaryMsg, "HTML");
      commandProcessed = true;
    }
    else if (text.startsWith("/completar")) {
      const matchWithSpace = text.match(/^\/completar\s+(\w+)/);
      const matchWithUnderscore = text.match(/^\/completar_(\w+)/);
      const taskId = matchWithSpace ? matchWithSpace[1] : (matchWithUnderscore ? matchWithUnderscore[1] : null);

      if (!taskId) {
        await sendMessage(chatId, `Porfi, dime el ID de la tarea que completaste ${MoeHandler.getRandomKaomoji()} Ejemplo: ${code("/completar_abcdef12")}`, "HTML");
      } else {
        const responseMsg = await TaskManager.completeTask(taskId, userId);
        await sendMessage(chatId, responseMsg, "HTML");
      }
      commandProcessed = true;
    }
    else if (text.startsWith("/trabajo")) {
      if (messageObject.reply_to_message && messageObject.reply_to_message.document) {
        const repliedMsg = messageObject.reply_to_message;
        const document = repliedMsg.document;
        const fileName = document.file_name || "";
        if (fileName.toLowerCase().endsWith(".doc") || fileName.toLowerCase().endsWith(".docx")) {
          const result = await TaskManager.setPinnedWork(
            repliedMsg.chat.id,
            repliedMsg.message_id,
            document,
            userId
          );
          await sendMessage(chatId, result.message, "HTML");
        } else {
          await sendMessage(chatId, escapeHTML(`⚠️ ¡Atención! Solo puedo fijar archivos <code>.doc</code> o <code>.docx</code>, ¿vale? ${MoeHandler.getRandomKaomoji()}`), "HTML");
        }
      } else {
        const result = await TaskManager.getPinnedWork();
        if (result.success && result.work) {
          const work = result.work;
          await sendMessage(chatId, `📄 ¡Aquí está el trabajito del proyecto que guardamos ("${escapeHTML(work.fileName)}")! ${MoeHandler.getRandomKaomoji()}`, "HTML");
          await sendDocumentByFileId(chatId, work.fileId, work.caption ? escapeHTML(work.caption) : null, "HTML");
        } else {
          await sendMessage(chatId, result.message, "HTML");
        }
      }
      commandProcessed = true;
    }
    else if (text.startsWith("/guardar_decision")) {
      const decisionText = text.substring("/guardar_decision".length).trim();
      if (!decisionText) {
        await sendMessage(chatId, `¡Nya~! Debes decirme qué decisión guardar, porfis ${MoeHandler.getRandomKaomoji()}`, "HTML");
      } else {
        const result = await OracleManager.saveOracleDecision(chatId, messageObject.message_id, userId, userFirstName, decisionText);
        await sendMessage(chatId, result.message, "HTML");
      }
      commandProcessed = true;
    }
    else if (text.startsWith("/oraculo")) {
      const questionText = text.substring("/oraculo".length).trim();
      if (questionText) {
         await sendMessage(chatId, `El Oráculo está consultando las estrellas... ${MoeHandler.getRandomKaomoji()} Espérame un poquito~`, "HTML");
         await delay(1500);
      }
      const oracleResponse = await OracleManager.queryOracle(questionText);
      await sendMessage(chatId, oracleResponse, "HTML");
      commandProcessed = true;
    }
    else { // No es un comando explícito
      const moeResponse = MoeHandler.getMoeResponse(text);
      if (moeResponse) {
        await sendMessage(chatId, moeResponse, "HTML");
        commandProcessed = true; // Considerar si las respuestas Moe deben evitar otras lógicas
      }
    }

    // Detector de Tareas Implícitas
    if (!commandProcessed && messageObject && messageObject.text && !messageObject.from.is_bot) {
      const textToAnalyze = messageObject.text.toLowerCase();
      let potentialTaskDescription = null;

      for (const keyword of TASK_TRIGGER_KEYWORDS) {
        const keywordIndex = textToAnalyze.indexOf(keyword);
        if (keywordIndex !== -1) {
          let isNegated = false;
          for (const negWord of NEGATION_KEYWORDS) {
            if (textToAnalyze.substring(Math.max(0, keywordIndex - negWord.length - 3), keywordIndex).includes(negWord)) {
              isNegated = true;
              break;
            }
          }
          if (isNegated) continue;

          let taskTextStartIndex = keywordIndex + keyword.length;
          potentialTaskDescription = messageObject.text.substring(taskTextStartIndex).trim();
          
          if (potentialTaskDescription.match(/^[,.:;!?\s]+/)) {
              potentialTaskDescription = potentialTaskDescription.replace(/^[,.:;!?\s]+/, "");
          }

          if (potentialTaskDescription.length > 150) {
            potentialTaskDescription = potentialTaskDescription.substring(0, 150) + "...";
          }
          
          if (potentialTaskDescription && potentialTaskDescription.length > 3) { // Ajustar longitud mínima
            break;
          } else {
            potentialTaskDescription = null;
          }
        }
      }

      if (potentialTaskDescription) {
        suggestionProcessed = true;
        const escapedDescription = escapeHTML(potentialTaskDescription);
        const shortDescriptionForButton = potentialTaskDescription.length > 25
            ? escapeHTML(potentialTaskDescription.substring(0, 22) + "...") 
            : escapeHTML(potentialTaskDescription);

        const messageText = `¡Oído cocina! (๑•̀ㅂ•́)و✧ Mencionaste algo sobre "${italic(escapedDescription)}". ¿Te gustaría que cree una tareíta para esto, sempai?`;
        
        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: `✔️ Sí: "${shortDescriptionForButton}"`, callback_data: `create_task_confirm:${encodeURIComponent(potentialTaskDescription)}` },
            ],
            [
              { text: `❌ No, gracias ${MoeHandler.getRandomKaomoji()}`, callback_data: "create_task_cancel" }
            ]
          ]
        };
        await sendMessage(chatId, messageText, "HTML", false, inlineKeyboard);
      }
    }

    // Guardar en Oráculo si no fue comando y no se sugirió tarea (o según prefieras)
    if (!commandProcessed && !suggestionProcessed && messageObject && messageObject.text && messageObject.text.trim() !== "" && !messageObject.from.is_bot) {
        await OracleManager.storeMessageForOracle(messageObject);
    }
    
    res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook Error General:", error);
    // Considerar enviar un mensaje de error genérico al chat si es apropiado y no se envió ya una respuesta
    // await sendMessage(chatId, `¡Uups! Algo se rompió en mis circuitos... ${MoeHandler.getRandomKaomoji()} Gomen~`);
    res.status(500).send("Internal Server Error");
  }
}