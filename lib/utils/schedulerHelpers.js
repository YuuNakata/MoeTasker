// lib/utils/schedulerHelpers.js
import { sendMessage } from "@/utils/telegram"; // Ajusta la ruta si es necesario
import * as TaskManager from "@/lib/services/taskManager";
import { escapeHTML, bold, italic, code, mention, link } from '@/lib/utils/htmlEscaper';

export async function triggerDailyReminders() {
  console.log(`[${new Date().toISOString()}] SCHEDULER: Ejecutando recordatorios diarios...`);
  const pendingTasks = await TaskManager.getTasksForDailyReminder();

  if (!pendingTasks || pendingTasks.length === 0) {
    console.log("SCHEDULER: No hay tareas pendientes para recordar.");
    return;
  }

  for (const task of pendingTasks) {
    const userMention = `[${MoeHandler.escapeHTML(task.assigned_to_name)}](tg://user?id=${task.assigned_to_id})`;
    const completeCommand = `/completar_${task.id}`; // Ya es código, no necesita escape extra
    const messageText =
        `📢 *Recordatorio de Tarea Pendiente*\n\n` +
        `🔔 Tarea: ${MoeHandler.escapeHTML(task.description)}\n` +
        `👤 Asignada a: ${userMention}\n` +
        `🆔 ID Tarea: \`${task.id}\`\n\n` + // Código
        `¡No olvides completarla! Usa \`${completeCommand}\``; // Código

    try {
      if (task.chat_id) {
        await sendMessage(task.chat_id, messageText, "MarkdownV2");
        console.log(`SCHEDULER: Recordatorio enviado para tarea ${task.id} a chat ${task.chat_id}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Pequeña pausa
      }
    } catch (error) {
      console.error(`SCHEDULER: Error al enviar recordatorio para tarea ${task.id}:`, error);
    }
  }
}

export async function triggerRandomFunMessage() {
  const targetGroupIdStr = process.env.TELEGRAM_TARGET_GROUP_ID;
  if (!targetGroupIdStr) {
    console.warn("SCHEDULER: TELEGRAM_TARGET_GROUP_ID no configurado.");
    return;
  }
  const targetGroupId = parseInt(targetGroupIdStr);
  console.log(`[${new Date().toISOString()}] SCHEDULER: Enviando mensaje aleatorio...`);
  try {
    const messageToSend = MoeHandler.getRandomPhraseForScheduler(); // Ya está escapado
    await sendMessage(targetGroupId, messageToSend, "MarkdownV2");
    console.log(`SCHEDULER: Mensaje aleatorio enviado al grupo ${targetGroupId}`);
  } catch (error) {
    console.error("SCHEDULER: Error al enviar mensaje aleatorio al grupo:", error);
  }
}