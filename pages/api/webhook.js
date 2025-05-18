// pages/api/webhook.js
import { sendMessage, sendDice, deleteMessage,editMessageText, forwardMessage, sendDocumentByFileId , sendSticker} from "@/utils/telegram";
import * as TaskManager from "@/lib/services/taskManager";
import * as MoeHandler from "@/lib/services/moeHandler";
import * as OracleManager from "@/lib/services/oracleManager";
import { escapeHTML, bold, italic, code } from '@/lib/utils/htmlEscaper';

export const config = {
  maxDuration: 60,
};

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
  
  let callbackQueryData = null;
  let userFromCallback = null;
  if (update.callback_query) {
    messageObject = update.callback_query.message;
    callbackQueryData = update.callback_query.data;
    userFromCallback = update.callback_query.from;
    console.log("Webhook: Es un callback_query. Data:", callbackQueryData);
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
    if (botUsername && text.includes(`@${botUsername}`)) {
      text = text.replace(`@${botUsername}`, "").trim();
    }
  }

  console.log(`Webhook Procesado: ChatID=${chatId}, UserID=${userId}, Text="${text}"`);
  let commandProcessed = false;

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
          const initialMsgResponse = await sendMessage(chatId, `🎲 ¡A la cargaaa! Asignando tareas... ${MoeHandler.getRandomKaomoji()}`);
          const initialMsgId = initialMsgResponse && initialMsgResponse.ok ? (await initialMsgResponse.json()).result.message_id : null;
          
          const diceResponse = await sendDice(chatId);
          const diceMsgId = diceResponse ? diceResponse.result.message_id : null;

          await delay(3500);
          
          if (initialMsgId) await editMessageText(chatId, initialMsgId, `⚙️ Procesando... ${MoeHandler.getRandomKaomoji()}`);
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
      const cleared = await TaskManager.clear_tasks(); // Asumimos que clear_tasks ahora es async
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
          await sendMessage(chatId, `📄 ¡Aquí está el trabajo del proyecto que guardamos ("${escapeHTML(work.fileName)}")! ${MoeHandler.getRandomKaomoji()}`, "HTML");
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
        await sendMessage(chatId, `Debes decirme qué decisión guardar, pls ${MoeHandler.getRandomKaomoji()}`, "HTML");
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
         await delay(1500); // Pequeña pausa para el efecto
      }
      const oracleResponse = await OracleManager.queryOracle(questionText);
      await sendMessage(chatId, oracleResponse, "HTML");
      commandProcessed = true;
    }
    else {
      const moeResponse = MoeHandler.getMoeResponse(text);
      if (moeResponse) {
        await sendMessage(chatId, moeResponse, "HTML");
        commandProcessed = true;
      }
    }

    if (!commandProcessed && messageObject && messageObject.text && messageObject.text.trim() !== "" && !messageObject.from.is_bot) {
        await OracleManager.storeMessageForOracle(messageObject);
    }
    
    res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Internal Server Error");
  }
}