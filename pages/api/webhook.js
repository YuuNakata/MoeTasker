// pages/api/webhook.js
import { sendMessage, sendDice, deleteMessage, editMessageText, forwardMessage, sendDocumentByFileId, sendSticker, answerCallbackQuery } from "@/utils/telegram";
import * as TaskManager from "@/lib/services/taskManager";
import * as MoeHandler from "@/lib/services/moeHandler";
import * as OracleManager from "@/lib/services/oracleManager";
import * as GitHubStatsService from '@/lib/services/gitHubStatsService'; // Nueva importación
import { query } from '@/lib/db';
import { randomBytes } from 'crypto';
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

function generateSuggestionKey() {
  return randomBytes(8).toString('hex'); // Genera 16 caracteres hexadecimales
}

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
    // messageObject es el mensaje DEL BOT con los botones
    const botMessageObject = cq.message;
    const callbackQueryData = cq.data;
    const userFromCallback = cq.from; // Quién presionó el botón
    const originalChatId = botMessageObject.chat.id;
    const originalMessageId = botMessageObject.message_id;


    console.log("Webhook: CallbackQuery. Data:", callbackQueryData, "UserID:", userFromCallback.id);

    try {
      if (callbackQueryData.startsWith("create_task_confirm_sugg:")) {
        const suggestionKey = callbackQueryData.split(":")[1];
        
        // Recuperar la descripción de la BD temporal
        const suggestionResult = await query(
          `SELECT full_description FROM temporary_task_suggestions WHERE suggestion_key = $1`,
          [suggestionKey]
        );
        if (suggestionResult.rows.length > 0) {
          const taskDescription = suggestionResult.rows[0].full_description;
          
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

          await query(`DELETE FROM temporary_task_suggestions WHERE suggestion_key = $1`, [suggestionKey]);

        } else {
          await editMessageText(originalChatId,originalMessageId,`¡Ups! ${MoeHandler.getRandomKaomoji()} Ya no recuerdo esa sugerencia... quizás expiró. Gomen~`, "HTML", null);
          await answerCallbackQuery(cq.id, { text: "Sugerencia no encontrada (つω`｡)" });
        }
      } else if (callbackQueryData === "create_task_cancel") {

        await editMessageText(
          originalChatId,
          originalMessageId,
          `¡De acuerdo, senpai! ${MoeHandler.getRandomKaomoji()} No crearé la tarea esta vez. Si cambias de opinión, ¡ya sabes dónde encontrarme!`,
          "HTML",
          null // Quitar teclado
        );
        await answerCallbackQuery(cq.id, { text: "Cancelado ( ´ ∀ ` )ﾉ" });
      }
      // ...
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
    const commandRegex = new RegExp(`^(\\/\\w+)(?:@${botUsername})?(.*)`, "i");
    const match = text.match(commandRegex);

    if (match) {
      text = (match[1] + match[2]).trim();
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
    else if (text.startsWith("/repo_stats")) {
      const GITHUB_PAT = process.env.GITHUB_PAT;
      const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
      const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

      if (!GITHUB_PAT || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
        await sendMessage(chatId, `¡Nya~! ${MoeHandler.getRandomKaomoji()} La configuración para estadísticas del repo está incompleta. Avisa a mi creador~`, "HTML");
        commandProcessed = true;
      } else {
        const args = text.substring("/repo_stats".length).trim().toLowerCase().split(" ");
        let period = args[0] || 'semana'; // 'semana', 'mes', 'total'
        let branch = args[1] || 'main'; // o la rama por defecto que prefieras
        let sinceISO = '';
        const now = new Date();

        if (period === 'semana') {
          now.setDate(now.getDate() - 7);
          sinceISO = now.toISOString();
        } else if (period === 'mes') {
          now.setMonth(now.getMonth() - 1);
          sinceISO = now.toISOString();
        } else if (period === 'total') {
          sinceISO = ''; // Traer todos los commits (puede ser muy lento/intensivo)
        } else {
          // Si no es un periodo reconocido, por defecto a semana y asumimos que 'period' era el nombre de la rama
          if (args[0]) branch = args[0]; // si hay algo en args[0] y no es semana/mes/total, es la rama
          period = 'semana'; // default a semana
          now.setDate(now.getDate() - 7);
          sinceISO = now.toISOString();
        }

        await sendMessage(chatId, `🔍 Analizando actividad del repositorio ${code(GITHUB_REPO_NAME)} para la ${bold(period)} en la rama ${code(branch)}... ¡Un momentito, senpai! ${MoeHandler.getRandomKaomoji()}`, "HTML");
        
        try {
          const stats = await GitHubStatsService.getRepoContributionStats(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_PAT, sinceISO, branch);

          if (!stats || Object.keys(stats).length === 0) {
            await sendMessage(chatId, `No encontré actividad reciente para el periodo y rama especificados. ${MoeHandler.getRandomKaomoji()}`, "HTML");
          } else {
            let responseText = `${bold(`📊 Estadísticas de Contribución para ${escapeHTML(GITHUB_REPO_NAME)} (${escapeHTML(branch)}) - Última ${period}`)}:\n\n`;
            const sortedContributors = Object.values(stats).sort((a, b) => b.totalModifications - a.totalModifications);
            
            let totalOverallModifications = 0;
            sortedContributors.forEach(c => totalOverallModifications += c.totalModifications);

            // Helper function for progress bar
            function generateProgressBar(percentage, length = 10) {
              const filledLength = Math.round((percentage / 100) * length);
              const emptyLength = length - filledLength;
              const filledChars = '█'.repeat(filledLength);
              const emptyChars = '░'.repeat(emptyLength);
              return `[${filledChars}${emptyChars}]`;
            }

            sortedContributors.forEach((contributor, index) => {
              const percentage = totalOverallModifications > 0 ? ((contributor.totalModifications / totalOverallModifications) * 100).toFixed(1) : "0.0";
              const trophy = index === 0 ? '🏆 ' : '';
              responseText += `${trophy}${bold(escapeHTML(contributor.name))}:\n`;
              responseText += `  🗳️ Commits: ${code(contributor.commits)}\n`;
              responseText += `  💹 Líneas Modificadas: ${code(contributor.totalModifications)} ${code('(+'+contributor.additions+' / -'+contributor.deletions+')')}\n`;
              responseText += `  🚀 Actividad: ${code(generateProgressBar(parseFloat(percentage)) + ' ' + percentage + '%')}\n`;
              if (index < sortedContributors.length - 1) {
                responseText += `------------------------------------\n`;
              }
            });
            await sendMessage(chatId, responseText, "HTML");
          }
        } catch (error) {
          console.error("Error al obtener estadísticas del repo:", error);
          await sendMessage(chatId, `¡Gomen nasai! ${MoeHandler.getRandomKaomoji()} Tuve problemas para obtener las estadísticas del repo. Revisa los logs, onegai~`, "HTML");
        }
        commandProcessed = true;
      }
    }
    else { // No es un comando explícito
      const moeResponse = MoeHandler.getMoeResponse(text);
      if (moeResponse) {
        await sendMessage(chatId, moeResponse, "HTML");
        commandProcessed = true; // Considerar si las respuestas Moe deben evitar otras lógicas
      }
    }

    // Integrar respuesta por palabras clave (saludos/despedidas)
    if (!commandProcessed) {
      const keywordResponse = MoeHandler.getKeywordResponse(text);
      if (keywordResponse) {
        await sendMessage(chatId, keywordResponse, "HTML", false, null, messageObject.message_id);
        commandProcessed = true; // Se envió una respuesta específica
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
          
          if (potentialTaskDescription && potentialTaskDescription.length > 3) { // Ajustar longitud mínima
            break;
          } else {
            potentialTaskDescription = null;
          }
        }
      }

      if (potentialTaskDescription) {
        suggestionProcessed = true;
        const suggestionKey = generateSuggestionKey();

        try {
          await query(
            `INSERT INTO temporary_task_suggestions (suggestion_key, full_description, chat_id, user_id)
             VALUES ($1, $2, $3, $4)`,
            [suggestionKey, potentialTaskDescription, chatId, userId]
          );

          // Ahora el texto del botón será más corto y el callback_data usará la clave
          const escapedOriginalTextPreview = escapeHTML(
            messageObject.text.length > 40 ? messageObject.text.substring(0, 37) + "..." : messageObject.text
          );
          // El shortDescriptionForButton es solo para el TEXTO del botón, no para callback_data
          const shortDescriptionForButtonText = potentialTaskDescription.length > 20 
            ? escapeHTML(potentialTaskDescription.substring(0, 17) + "...") 
            : escapeHTML(potentialTaskDescription);


          const messageText = `¡Oído cocina! (๑•̀ㅂ•́)و✧ Detecté que mencionaste "${italic(escapedOriginalTextPreview)}". ¿Debería crear una tareíta para "${italic(escapeHTML(potentialTaskDescription))}", senpai?`;
          
          const inlineKeyboard = {
            inline_keyboard: [
              [
                // El texto del botón puede ser más descriptivo
                { text: `✔️ Sí: "${shortDescriptionForButtonText}"`, callback_data: `create_task_confirm_sugg:${suggestionKey}` }, // Usar la clave
              ],
              [
                { text: `❌ No, gracias ${MoeHandler.getRandomKaomoji()}`, callback_data: "create_task_cancel" }
              ]
            ]
          };
          await sendMessage(chatId, messageText, "HTML", false, inlineKeyboard);

        } catch (dbError) {
          console.error("Error guardando sugerencia de tarea temporal:", dbError);
          suggestionProcessed = false; // Falló, así que no la consideramos procesada
        }
      }
    }

    // Guardar en Oráculo si no fue comando y no se sugirió tarea (o según prefieras)
    if (!commandProcessed && !suggestionProcessed && messageObject && messageObject.text && messageObject.text.trim() !== "" && !messageObject.from.is_bot) {
        await OracleManager.storeMessageForOracle(messageObject);
    }

    // Fallback de Sticker Mejorado
    if (!commandProcessed && !suggestionProcessed) {
      let shouldSendSticker = false;
      // Condición ÚNICA: Es una respuesta directa al bot
      if (messageObject.reply_to_message &&
          messageObject.reply_to_message.from &&
          messageObject.reply_to_message.from.is_bot &&
          messageObject.reply_to_message.from.username === process.env.BOT_USERNAME) { // Comparar con el username del bot
        shouldSendSticker = true;
      }

      if (shouldSendSticker) {
        const stickerFileId = MoeHandler.getRandomReplySticker();
        if (stickerFileId) {
          try {
            await sendSticker(chatId, stickerFileId);
          } catch (e) {
            console.error("Webhook: Error al enviar sticker de fallback:", e);
          }
        }
      }
    }
    
    res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook Error General:", error);
    // Considerar enviar un mensaje de error genérico al chat si es apropiado y no se envió ya una respuesta
    // await sendMessage(chatId, `¡Uups! Algo se rompió en mis circuitos... ${MoeHandler.getRandomKaomoji()} Gomen~`);
    res.status(500).send("Internal Server Error");
  }
}