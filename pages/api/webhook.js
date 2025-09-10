// pages/api/webhook.js
import {
  sendMessage,
  sendDice,
  deleteMessage,
  editMessageText,
  forwardMessage,
  sendDocumentByFileId,
  sendSticker,
  answerCallbackQuery,
  sendChatAction,
  getFilePath,
} from "@/utils/telegram";
import * as TaskManager from "@/lib/services/taskManager";
import * as MoeHandler from "@/lib/services/moeHandler";
import * as OracleManager from "@/lib/services/oracleManager";
import * as StickerManager from "@/lib/services/stickerManager"; // Added import
import * as GitHubStatsService from "@/lib/services/gitHubStatsService"; // Nueva importación
import { query } from "@/lib/db";
import { randomBytes } from "crypto";
import { escapeHTML, bold, italic, code } from "@/lib/utils/htmlEscaper";
import { getAiResponse, getVisionResponse } from "@/pages/api/chat";
import { getMemberById } from "@/lib/services/teamManager";

export const config = {
  maxDuration: 60,
};

const TASK_TRIGGER_KEYWORDS = [""];
const NEGATION_KEYWORDS = ["no", "nunca", "tampoco"];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function generateSuggestionKey() {
  return randomBytes(8).toString("hex"); // Genera 16 caracteres hexadecimales
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).send("Method Not Allowed");
  }

  const update = req.body;
  let aiReplied = false; // Flag para saber si la IA ya respondió

  let messageObject =
    update.message ||
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

    console.log(
      "Webhook: CallbackQuery. Data:",
      callbackQueryData,
      "UserID:",
      userFromCallback.id,
    );

    try {
      if (callbackQueryData.startsWith("create_task_confirm_sugg:")) {
        const suggestionKey = callbackQueryData.split(":")[1];

        // Recuperar la descripción de la BD temporal
        const suggestionResult = await query(
          `SELECT full_description FROM temporary_task_suggestions WHERE suggestion_key = $1`,
          [suggestionKey],
        );
        if (suggestionResult.rows.length > 0) {
          const taskDescription = suggestionResult.rows[0].full_description;

          const result = await TaskManager.assignTasks(originalChatId, [
            taskDescription,
          ]);
          let confirmationText = `¡Entendido! ${MoeHandler.getRandomKaomoji()} He creado la tareíta: "${escapeHTML(taskDescription)}".`;
          if (result.message && result.message.includes("Asignada a:")) {
            confirmationText += `\n${result.message}`;
          }

          await editMessageText(
            originalChatId,
            originalMessageId,
            confirmationText.trim(),
            "HTML",
            null, // Quitar teclado
          );

          await answerCallbackQuery(cq.id, { text: "¡Tarea creada! ✨" });

          await query(
            `DELETE FROM temporary_task_suggestions WHERE suggestion_key = $1`,
            [suggestionKey],
          );
        } else {
          await editMessageText(
            originalChatId,
            originalMessageId,
            `¡Ups! ${MoeHandler.getRandomKaomoji()} Ya no recuerdo esa sugerencia... quizás expiró. Gomen~`,
            "HTML",
            null,
          );
          await answerCallbackQuery(cq.id, {
            text: "Sugerencia no encontrada (つω`｡)",
          });
        }
      } else if (callbackQueryData === "create_task_cancel") {
        await editMessageText(
          originalChatId,
          originalMessageId,
          `¡De acuerdo, senpai! ${MoeHandler.getRandomKaomoji()} No crearé la tarea esta vez. Si cambias de opinión, ¡ya sabes dónde encontrarme!`,
          "HTML",
          null, // Quitar teclado
        );
        await answerCallbackQuery(cq.id, { text: "Cancelado ( ´ ∀ ` )ﾉ" });
      }
      // ...
    } catch (error) {
      console.error("Error procesando callback_query:", error);
      await answerCallbackQuery(cq.id, {
        text: "¡Ups! Algo salió mal (つω`｡)",
      });
    }

    return res.status(200).send("OK");
  }

  if (!messageObject) {
    console.warn(
      "Webhook: No se pudo extraer un objeto de mensaje procesable del update.",
      update,
    );
    return res.status(200).send("OK");
  }

  if (
    messageObject.new_chat_members &&
    messageObject.new_chat_members.length > 0
  ) {
    const chatId = messageObject.chat.id;
    for (const member of messageObject.new_chat_members) {
      if (member.is_bot && member.username === process.env.BOT_USERNAME) {
        await sendMessage(
          chatId,
          `¡Konichiwa minna-san! (≧◡≦) Soy ${process.env.BOT_NAME || "su nueva amiga bot"}, ¡lista para ayudarles con el proyecto! Usen ${code("/help")} para ver mis poderes~ ✨`,
        );
      } else if (!member.is_bot) {
        // Generar mensaje de bienvenida dinámico con IA
        try {
          const welcomePrompt = `Un nuevo miembro llamado "${member.first_name}" se ha unido al grupo de desarrollo. Genera un mensaje de bienvenida cálido y amigable para darle la bienvenida al equipo. Hazlo único y especial, pero mantén tu personalidad anime. Incluye su nombre en el mensaje. Hazlo en una sola línea, máximo 2 oraciones.`;

          const aiWelcomeMessage = await getAiResponse([
            { role: "user", content: welcomePrompt },
          ]);

          if (aiWelcomeMessage && aiWelcomeMessage.trim()) {
            // Escapar el mensaje para MarkdownV2
            const escapedMessage =
              MoeHandler.escapeMarkdownV2(aiWelcomeMessage);
            await sendMessage(chatId, escapedMessage, "MarkdownV2");
          } else {
            // Fallback en caso de que la IA no responda
            await sendMessage(
              chatId,
              `¡Bienvenido/a al equipo, ${escapeHTML(member.first_name)}-san! ${MoeHandler.getRandomKaomoji()} ¡Espero que trabajemos súper bien juntos!`,
            );
          }
        } catch (error) {
          console.error("Error generando mensaje de bienvenida con IA:", error);
          // Fallback en caso de error
          await sendMessage(
            chatId,
            `¡Bienvenido/a al equipo, ${escapeHTML(member.first_name)}-san! ${MoeHandler.getRandomKaomoji()} ¡Espero que trabajemos súper bien juntos!`,
          );
        }
      }
    }
    return res.status(200).send("OK");
  }

  // Bloque de stickers de respuesta rápida eliminado para dar prioridad a la lógica de IA.

  const chatId = messageObject.chat.id;
  let text = messageObject.text || "";
  const userId = messageObject.from.id;
  const userFirstName = messageObject.from.first_name || "Usuario";

  // TEMPORAL: Logging para obtener IDs de usuarios
  if (messageObject.from && !messageObject.from.is_bot) {
    console.log(`🔍 Usuario detectado:`, {
      id: messageObject.from.id,
      first_name: messageObject.from.first_name,
      username: messageObject.from.username || "sin_username",
      chat_type: messageObject.chat.type,
      chat_id: messageObject.chat.id,
    });
  }

  if (
    messageObject.chat.type === "group" ||
    messageObject.chat.type === "supergroup"
  ) {
    const botUsername = process.env.BOT_USERNAME;
    const commandRegex = new RegExp(`^(\\/\\w+)(?:@${botUsername})?(.*)`, "i");
    const match = text.match(commandRegex);

    if (match) {
      text = (match[1] + match[2]).trim();
    }
  }

  console.log(
    `Webhook Procesado: ChatID=${chatId}, UserID=${userId}, Text=\"${text}\"`,
  );
  let commandProcessed = false;
  let suggestionProcessed = false;

  // --- Lógica de Reconocimiento de Imágenes ---
  if (!aiReplied && messageObject && messageObject.text) {
    const isReplyToPhoto =
      messageObject.reply_to_message && messageObject.reply_to_message.photo;
    const textLowerCase = messageObject.text.toLowerCase();
    // Hacemos el trigger más específico para evitar falsos positivos
    const visionTrigger = textLowerCase.includes("moe");

    if (isReplyToPhoto && visionTrigger) {
      await sendChatAction(chatId);

      const photo =
        messageObject.reply_to_message.photo[
          messageObject.reply_to_message.photo.length - 1
        ];
      const fileId = photo.file_id;
      const filePath = await getFilePath(fileId);

      if (filePath) {
        const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
        // Un prompt más específico para guiar la personalidad de la respuesta de visión
        const userPrompt =
          "Describe esta imagen de forma amigable y en español, como una chica moe de anime. Sé detallada pero concisa.";
        const visionResponse = await getVisionResponse(imageUrl, userPrompt);

        const escapedResponse = MoeHandler.escapeMarkdownV2(visionResponse);
        await sendMessage(chatId, escapedResponse, "MarkdownV2");

        aiReplied = true;
      } else {
        await sendMessage(
          chatId,
          "Uhm... no pude obtener la imagen para verla, gomen >.<",
        );
      }
    }
  }

  try {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const helpText = MoeHandler.getHelpMessage(userFirstName);
      await sendMessage(chatId, helpText, "HTML");
      commandProcessed = true;
    } else if (text.startsWith("/frase") || text.startsWith("/relax")) {
      const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
      await sendMessage(chatId, `${phrase} ${kaomoji}`, "HTML");
      commandProcessed = true;
    } else if (text.startsWith("/asignar")) {
      const argsText = text.substring("/asignar".length).trim();
      if (!argsText) {
        await sendMessage(
          chatId,
          `Por favor, proporciona las tareas después del comando. Ejemplo: ${code("/asignar Tarea A, Tarea B")} ${MoeHandler.getRandomKaomoji()}`,
          "HTML",
        );
      } else {
        const taskDescriptions = argsText
          .split(",")
          .map((desc) => desc.trim())
          .filter(Boolean);
        if (!taskDescriptions.length) {
          await sendMessage(
            chatId,
            `Debes proporcionar al menos una descripción de tarea válida, ¿siii? ${MoeHandler.getRandomKaomoji()}`,
            "HTML",
          );
        } else {
          const initialMsgResponse = await sendMessage(
            chatId,
            `🎲 ¡A la cargaaa! Asignando tareitas... ${MoeHandler.getRandomKaomoji()}`,
          );
          let initialMsgId = null;
          if (initialMsgResponse && initialMsgResponse.ok) {
            const initialMsgData = await initialMsgResponse.json();
            initialMsgId = initialMsgData.result.message_id;
          }

          const diceApiResponse = await sendDice(chatId);
          const diceMsgId = diceApiResponse
            ? diceApiResponse.result.message_id
            : null;

          await delay(3500);

          if (initialMsgId)
            await editMessageText(
              chatId,
              initialMsgId,
              `⚙️ Procesando con mucho amor... ${MoeHandler.getRandomKaomoji()}`,
            );
          await delay(1000);

          const result = await TaskManager.assignTasks(
            chatId,
            taskDescriptions,
          );

          if (initialMsgId) await deleteMessage(chatId, initialMsgId);
          if (diceMsgId) await deleteMessage(chatId, diceMsgId);

          await sendMessage(chatId, result.message, "HTML");
        }
      }
      commandProcessed = true;
    } else if (text.startsWith("/tareas")) {
      const summary = await TaskManager.getPendingTasksSummary();
      await sendMessage(chatId, summary, "HTML");
      commandProcessed = true;
    } else if (text.startsWith("/clear_tasks")) {
      let summaryMsg = ``;
      const cleared = await TaskManager.clear_tasks();
      if (cleared) {
        summaryMsg = `¡Todas las tareas han desaparecido! ¡Puf! ✨ ${MoeHandler.getRandomKaomoji()}`;
      } else {
        summaryMsg = `Uups, no pude borrar las tareas esta vez... ${MoeHandler.getRandomKaomoji()}`;
      }
      await sendMessage(chatId, summaryMsg, "HTML");
      commandProcessed = true;
    } else if (text.startsWith("/completar")) {
      const matchWithSpace = text.match(/^\/completar\s+(\w+)/);
      const matchWithUnderscore = text.match(/^\/completar_(\w+)/);
      const taskId = matchWithSpace
        ? matchWithSpace[1]
        : matchWithUnderscore
          ? matchWithUnderscore[1]
          : null;

      if (!taskId) {
        await sendMessage(
          chatId,
          `Porfi, dime el ID de la tarea que completaste ${MoeHandler.getRandomKaomoji()} Ejemplo: ${code("/completar_abcdef12")}`,
          "HTML",
        );
      } else {
        const responseMsg = await TaskManager.completeTask(taskId, userId);
        await sendMessage(chatId, responseMsg, "HTML");
      }
      commandProcessed = true;
    } else if (text.startsWith("/trabajo")) {
      if (
        messageObject.reply_to_message &&
        messageObject.reply_to_message.document
      ) {
        const repliedMsg = messageObject.reply_to_message;
        const document = repliedMsg.document;
        const fileName = document.file_name || "";
        if (
          fileName.toLowerCase().endsWith(".doc") ||
          fileName.toLowerCase().endsWith(".docx")
        ) {
          const result = await TaskManager.setPinnedWork(
            repliedMsg.chat.id,
            repliedMsg.message_id,
            document,
            userId,
          );
          await sendMessage(chatId, result.message, "HTML");
        } else {
          await sendMessage(
            chatId,
            escapeHTML(
              `⚠️ ¡Atención! Solo puedo fijar archivos <code>.doc</code> o <code>.docx</code>, ¿vale? ${MoeHandler.getRandomKaomoji()}`,
            ),
            "HTML",
          );
        }
      } else {
        const result = await TaskManager.getPinnedWork();
        if (result.success && result.work) {
          const work = result.work;
          await sendMessage(
            chatId,
            `📄 ¡Aquí está el trabajito del proyecto que guardamos ("${escapeHTML(work.fileName)}")! ${MoeHandler.getRandomKaomoji()}`,
            "HTML",
          );
          await sendDocumentByFileId(
            chatId,
            work.fileId,
            work.caption ? escapeHTML(work.caption) : null,
            "HTML",
          );
        } else {
          await sendMessage(chatId, result.message, "HTML");
        }
      }
      commandProcessed = true;
    } else if (text.startsWith("/guardar_decision")) {
      const decisionText = text.substring("/guardar_decision".length).trim();
      if (!decisionText) {
        await sendMessage(
          chatId,
          `¡Nya~! Debes decirme qué decisión guardar, porfis ${MoeHandler.getRandomKaomoji()}`,
          "HTML",
        );
      } else {
        const result = await OracleManager.saveOracleDecision(
          chatId,
          messageObject.message_id,
          userId,
          userFirstName,
          decisionText,
        );
        await sendMessage(chatId, result.message, "HTML");
      }
      commandProcessed = true;
    } else if (text.startsWith("/oraculo")) {
      const questionText = text.substring("/oraculo".length).trim();
      if (questionText) {
        await sendMessage(
          chatId,
          `El Oráculo está consultando las estrellas... ${MoeHandler.getRandomKaomoji()} Espérame un poquito~`,
          "HTML",
        );
        await delay(1500);
      }
      const oracleResponse = await OracleManager.queryOracle(questionText);
      await sendMessage(chatId, oracleResponse, "HTML");
      commandProcessed = true;
    } else if (text.startsWith("/repo_stats")) {
      const GITHUB_PAT = process.env.GITHUB_PAT;
      const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
      const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

      if (!GITHUB_PAT || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
        await sendMessage(
          chatId,
          `¡Nya~! ${MoeHandler.getRandomKaomoji()} La configuración para estadísticas del repo está incompleta. Avisa a mi creador~`,
          "HTML",
        );
        commandProcessed = true;
      } else {
        const args = text
          .substring("/repo_stats".length)
          .trim()
          .toLowerCase()
          .split(" ");
        let period = args[0] || "semana"; // 'semana', 'mes', 'total'
        let branch = args[1] || "main"; // o la rama por defecto que prefieras
        let sinceISO = "";
        const now = new Date();

        if (period === "semana") {
          now.setDate(now.getDate() - 7);
          sinceISO = now.toISOString();
        } else if (period === "mes") {
          now.setMonth(now.getMonth() - 1);
          sinceISO = now.toISOString();
        } else if (period === "total") {
          sinceISO = ""; // Traer todos los commits (puede ser muy lento/intensivo)
        } else {
          // Si no es un periodo reconocido, por defecto a semana y asumimos que 'period' era el nombre de la rama
          if (args[0]) branch = args[0]; // si hay algo en args[0] y no es semana/mes/total, es la rama
          period = "semana"; // default a semana
          now.setDate(now.getDate() - 7);
          sinceISO = now.toISOString();
        }

        await sendMessage(
          chatId,
          `🔍 Analizando actividad del repositorio ${code(GITHUB_REPO_NAME)} para la ${bold(period)} en la rama ${code(branch)}... ¡Un momentito, senpai! ${MoeHandler.getRandomKaomoji()}`,
          "HTML",
        );

        try {
          const stats = await GitHubStatsService.getRepoContributionStats(
            GITHUB_REPO_OWNER,
            GITHUB_REPO_NAME,
            GITHUB_PAT,
            sinceISO,
            branch,
          );

          if (!stats || Object.keys(stats).length === 0) {
            await sendMessage(
              chatId,
              `No encontré actividad reciente para el periodo y rama especificados. ${MoeHandler.getRandomKaomoji()}`,
              "HTML",
            );
          } else {
            let responseText = `${bold(`📊 Estadísticas de Contribución para ${escapeHTML(GITHUB_REPO_NAME)} (${escapeHTML(branch)}) - Última ${period}`)}:\n\n`;
            const sortedContributors = Object.values(stats).sort(
              (a, b) => b.totalModifications - a.totalModifications,
            );

            let totalOverallModifications = 0;
            sortedContributors.forEach(
              (c) => (totalOverallModifications += c.totalModifications),
            );

            // Helper function for progress bar
            function generateProgressBar(percentage, length = 10) {
              const filledLength = Math.round((percentage / 100) * length);
              const emptyLength = length - filledLength;
              const filledChars = "█".repeat(filledLength);
              const emptyChars = "░".repeat(emptyLength);
              return `[${filledChars}${emptyChars}]`;
            }

            sortedContributors.forEach((contributor, index) => {
              const percentage =
                totalOverallModifications > 0
                  ? (
                      (contributor.totalModifications /
                        totalOverallModifications) *
                      100
                    ).toFixed(1)
                  : "0.0";
              const trophy = index === 0 ? "🏆 " : "";
              responseText += `${trophy}${bold(escapeHTML(contributor.name))}:\n`;
              responseText += `  🗳️ Commits: ${code(contributor.commits)}\n`;
              responseText += `  💹 Líneas Modificadas: ${code(contributor.totalModifications)} ${code("(+" + contributor.additions + " / -" + contributor.deletions + ")")}\n`;
              responseText += `  🚀 Actividad: ${code(generateProgressBar(parseFloat(percentage)) + " " + percentage + "%")}\n`;
              if (index < sortedContributors.length - 1) {
                responseText += `------------------------------------\n`;
              }
            });
            await sendMessage(chatId, responseText, "HTML");
          }
        } catch (error) {
          console.error("Error al obtener estadísticas del repo:", error);
          await sendMessage(
            chatId,
            `¡Gomen nasai! ${MoeHandler.getRandomKaomoji()} Tuve problemas para obtener las estadísticas del repo. Revisa los logs, onegai~`,
            "HTML",
          );
        }
        commandProcessed = true;
      }
    } else if (text.startsWith("/miembros")) {
      // Comando de prueba para verificar miembros activos del grupo
      commandProcessed = true;
      try {
        // Determinar qué grupo usar - TARGET_GROUP_ID si está disponible, sino chatId actual
        const targetGroupId = process.env.TARGET_GROUP_ID || chatId;
        const isUsingTargetGroup =
          process.env.TARGET_GROUP_ID &&
          process.env.TARGET_GROUP_ID !== chatId.toString();

        let statusMessage = `🔍 Verificando miembros activos del grupo`;
        if (isUsingTargetGroup) {
          statusMessage += ` (ID: ${code(targetGroupId)})`;
        }
        statusMessage += `... ${MoeHandler.getRandomKaomoji()}`;

        await sendMessage(chatId, statusMessage, "HTML");

        const { getActiveTeamMembers } = await import(
          "@/lib/services/taskManager"
        );
        const activeMembers = await getActiveTeamMembers(targetGroupId);

        if (activeMembers && activeMembers.length > 0) {
          let membersText = `👥 ${bold("Miembros Activos del Equipo:")}`;
          if (isUsingTargetGroup) {
            membersText += ` ${bold("(Grupo Principal)")}`;
          }
          membersText += `\n\n`;
          activeMembers.forEach((member, index) => {
            membersText += `${index + 1}. ${escapeHTML(member.name)} (ID: ${code(member.id.toString())})`;
            if (member.username) {
              membersText += ` - @${escapeHTML(member.username)}`;
            }
            membersText += `\n`;
          });

          membersText += `\n✨ Total: ${bold(activeMembers.length.toString())} miembros disponibles para asignación de tareas.`;

          await sendMessage(chatId, membersText, "HTML");
        } else {
          let errorMessage = `❌ No se pudieron obtener los miembros activos del grupo`;
          if (isUsingTargetGroup) {
            errorMessage += ` principal (ID: ${code(targetGroupId)})`;
          }
          errorMessage += `. ${MoeHandler.getRandomKaomoji()}`;

          await sendMessage(chatId, errorMessage, "HTML");
        }
      } catch (error) {
        console.error("Error en comando /miembros:", error);
        await sendMessage(
          chatId,
          `⚠️ Error al verificar los miembros: ${escapeHTML(error.message)}`,
          "HTML",
        );
      }
    } else if (text.startsWith("/config")) {
      // Comando para verificar la configuración del bot
      commandProcessed = true;
      try {
        let configText = `⚙️ ${bold("Configuración del Bot MoeTasker:")}\n\n`;

        // Información básica del bot
        const botUsername = process.env.BOT_USERNAME || "No configurado";
        const botName = process.env.BOT_NAME || "No configurado";
        configText += `🤖 ${bold("Bot Username:")} ${code(botUsername)}\n`;
        configText += `📛 ${bold("Bot Name:")} ${escapeHTML(botName)}\n\n`;

        // Configuración del grupo objetivo
        const targetGroupId = process.env.TARGET_GROUP_ID || "No configurado";
        configText += `🎯 ${bold("Grupo Principal (TARGET_GROUP_ID):")} ${code(targetGroupId)}\n`;

        // ID de Claudia
        const claudiaId = process.env.USER_ID_CLAUDIA || "No configurado";
        configText += `👤 ${bold("Claudia ID:")} ${code(claudiaId)}\n\n`;

        // Estado del chat actual
        const currentChatType = messageObject.chat.type;
        configText += `💬 ${bold("Chat Actual:")} ${escapeHTML(currentChatType)} (ID: ${code(chatId.toString())})\n`;

        // Verificar si el chat actual es el grupo objetivo
        if (targetGroupId !== "No configurado") {
          const isTargetGroup = targetGroupId === chatId.toString();
          if (isTargetGroup) {
            configText += `✅ ${bold("Este es el grupo principal configurado")}\n`;
          } else {
            configText += `ℹ️ ${bold("Este NO es el grupo principal")}\n`;
          }
        }

        configText += `\n🔧 ${bold("Estado del Sistema:")}\n`;
        configText += `- Detección dinámica de miembros: ✅ Activa\n`;
        configText += `- Grupo objetivo: ${targetGroupId !== "No configurado" ? "✅ Configurado" : "⚠️ No configurado"}\n`;

        await sendMessage(chatId, configText, "HTML");
      } catch (error) {
        console.error("Error en comando /config:", error);
        await sendMessage(
          chatId,
          `⚠️ Error al verificar la configuración: ${escapeHTML(error.message)}`,
          "HTML",
        );
      }
    } else if (text.startsWith("/add_sticker")) {
      commandProcessed = true;
      if (
        messageObject.reply_to_message &&
        messageObject.reply_to_message.sticker
      ) {
        const sticker = messageObject.reply_to_message.sticker;

        if (sticker.is_animated || sticker.is_video) {
          await sendMessage(
            chatId,
            `¡Gomen, senpai! (｡>_<｡) Por ahora mis ojitos mágicos solo pueden analizar stickers estáticos. ¡Todavía no puedo ver los que se mueven!`,
            null,
          );
          return;
        }

        const fileId = sticker.file_id;
        const userId = messageObject.from.id;

        try {
          await sendChatAction(chatId, "typing");
          await sendMessage(
            chatId,
            `Analizando el sticker con mi ojo mágico... (๑✧ω✧๑) Un momento, por favor.`,
            "HTML",
          );

          const filePath = await getFilePath(fileId);
          if (!filePath) {
            throw new Error(
              "No se pudo obtener la ruta del archivo del sticker desde Telegram.",
            );
          }
          const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

          // Descargar el contenido de la imagen
          const imageResponse = await fetch(fileUrl);
          if (!imageResponse.ok) {
            throw new Error("No se pudo descargar el sticker desde Telegram.");
          }
          const contentType =
            imageResponse.headers.get("content-type") || "image/webp";
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString("base64");
          const imageDataUrl = `data:${contentType};base64,${imageBase64}`;

          const visionPrompt =
            "Describe la emoción o el contenido de este sticker en 3 o 4 palabras clave en español, separadas por comas. Sé concisa y directa. Por ejemplo: feliz, saludo, adorable. O: confundido, pensando, duda. O: llorando, triste, drama. Solo devuelve las palabras clave.";
          const categoriesText = await getVisionResponse(
            imageDataUrl,
            visionPrompt,
          );

          if (!categoriesText || categoriesText.trim() === "") {
            throw new Error(
              "La IA no pudo generar categorías para el sticker.",
            );
          }

          const categories = categoriesText
            .split(",")
            .map((cat) => cat.trim().toLowerCase());

          await StickerManager.addSticker(fileId, categories, userId);

          await sendMessage(
            chatId,
            `¡Hecho! ✨ He guardado este sticker con las categorías: ${code(categories.join(", "))}. ¡Lo usaré cuando la ocasión lo amerite!`,
            "HTML",
          );
        } catch (error) {
          console.error("Error al procesar /add_sticker:", error);
          await sendMessage(
            chatId,
            `¡Ups! Algo salió mal y no pude guardar el sticker. ¡Gomen! (｡•́︿•̀｡)\nError: ${error.message}`,
            "HTML",
          );
        }
      } else {
        await sendMessage(
          chatId,
          "Para agregar un sticker, responde a un sticker con el comando /add_sticker, senpai. (´• ω •`)",
          "HTML",
        );
      }
    } else {
      // No es un comando explícito
    }

    /*
    --- DETECTOR DE TAREAS IMPLÍCITAS (DESACTIVADO POR EL USUARIO) ---
    Esta funcionalidad ha sido desactivada a petición del usuario
    para evitar que interfiera con otras respuestas del bot.
    */

    // Guardar en Oráculo si no fue comando y no se sugirió tarea (o según prefieras)
    if (
      !commandProcessed &&
      messageObject &&
      messageObject.text &&
      messageObject.text.trim() !== "" &&
      !messageObject.from.is_bot
    ) {
      await OracleManager.storeMessageForOracle(messageObject);
    }

    // --- Integración de IA para Respuestas Conversacionales ---
    if (
      !commandProcessed &&
      !suggestionProcessed &&
      messageObject &&
      messageObject.text &&
      !messageObject.from.is_bot
    ) {
      const botUsername = process.env.BOT_USERNAME || "MoeTasker"; // Fallback por si no está en .env
      const messageText = messageObject.text.toLowerCase();

      const isReplyToBot =
        messageObject.reply_to_message &&
        messageObject.reply_to_message.from &&
        messageObject.reply_to_message.from.is_bot &&
        messageObject.reply_to_message.from.username === botUsername;

      const isMentioningBot = messageText.includes("moe");

      if (isReplyToBot || isMentioningBot) {
        try {
          // 1. Obtener historial de la conversación desde el Oráculo
          const recentMessages = await OracleManager.getRecentMessages(
            chatId,
            10,
          );

          // 2. Formatear mensajes para la API de IA
          const formattedMessages = recentMessages.map((msg) => ({
            role: msg.is_bot ? "assistant" : "user",
            content: msg.text,
          }));

          // Añadir el mensaje actual, dando más contexto si es una respuesta
          let currentUserMessageContent = messageObject.text;
          if (
            isReplyToBot &&
            messageObject.reply_to_message &&
            messageObject.reply_to_message.text
          ) {
            // Damos a la IA el contexto directo del mensaje al que se responde para mayor relevancia.
            currentUserMessageContent = `(Respondiendo a tu mensaje: "${messageObject.reply_to_message.text}")\n\n${messageObject.text}`;
          }

          formattedMessages.push({
            role: "user",
            content: currentUserMessageContent,
          });

          // 3. Mostrar el indicador "escribiendo..."
          await sendChatAction(chatId);

          // 4. Identificar al usuario y llamar a la lógica de la IA
          const speakingUser = getMemberById(userId);
          const aiText = await getAiResponse(formattedMessages, speakingUser);

          if (aiText) {
            // 4. Escapar el texto para MarkdownV2, pero ignorando los bloques de código.
            const parts = aiText.split(/(```[\s\S]*?```)/g);
            const escapedParts = parts.map((part, index) => {
              if (index % 2 === 1) return part;
              return MoeHandler.escapeMarkdownV2(part);
            });
            const escapedText = escapedParts.join("");

            // 5. Enviar la respuesta de la IA a Telegram
            await sendMessage(chatId, escapedText, "MarkdownV2");
            aiReplied = true; // ¡La IA ha hablado! Marcamos la bandera.

            // --- LÓGICA PARA ENVIAR STICKER ---
            try {
              // Aumentamos la probabilidad al 75% para que la función se note más
              if (Math.random() < 0.75) {
                const stickerPrompt = `Analiza el siguiente texto y extrae un máximo de 2 palabras clave que representen el concepto o la emoción más importante. Prioriza sustantivos o adjetivos específicos y únicos. Evita palabras comunes o genéricas. Devuelve solo las palabras separadas por comas. Texto: "${aiText}"`;

                const categoriesText = await getAiResponse([
                  { role: "user", content: stickerPrompt },
                ]);

                if (categoriesText) {
                  const categories = categoriesText
                    .split(",")
                    .map((cat) => cat.trim().toLowerCase())
                    .filter((c) => c);
                  if (categories.length > 0) {
                    // Log de diagnóstico para ver qué categorías se están buscando
                    console.log(
                      `Buscando sticker con categorías extraídas: ${categories.join(", ")}`,
                    );
                    const sticker =
                      await StickerManager.findRandomStickerByCategories(
                        categories,
                      );
                    if (sticker && sticker.file_id) {
                      await sendSticker(chatId, sticker.file_id);
                    }
                  }
                }
              }
            } catch (stickerError) {
              console.error(
                "Error al intentar enviar un sticker contextual:",
                stickerError,
              );
              // No molestamos al usuario si el sticker falla, es un extra.
            }
          }
        } catch (aiError) {
          console.error(
            "Webhook: Error en el bloque de IA conversacional:",
            aiError,
          );
          // Opcional: enviar un mensaje de error si la IA falla
          // await sendMessage(chatId, `¡Gomen, senpai! Mis circuitos de IA fallaron... ${MoeHandler.getRandomKaomoji()}`);
        }
      }
    }

    /* --- STICKER FALLBACK DESACTIVADO TEMPORALMENTE ---
    // La idea es reactivar esto en el futuro con una lógica que
    // elija un sticker según el 'mood' de la conversación.
    // Fallback de Sticker (solo si la IA no ha respondido y es un reply)
    if (!commandProcessed && !suggestionProcessed && !aiReplied && messageObject) {
      const isReplyToBot = messageObject.reply_to_message &&
                           messageObject.reply_to_message.from &&
                           messageObject.reply_to_message.from.is_bot &&
                           messageObject.reply_to_message.from.username === (process.env.BOT_USERNAME || 'MoeTasker');

      if (isReplyToBot) {
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
    */

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error General:", error);
    // Considerar enviar un mensaje de error genérico al chat si es apropiado y no se envió ya una respuesta
    // await sendMessage(chatId, `¡Uups! Algo se rompió en mis circuitos... ${MoeHandler.getRandomKaomoji()} Gomen~`);
    res.status(500).send("Internal Server Error");
  }
}
