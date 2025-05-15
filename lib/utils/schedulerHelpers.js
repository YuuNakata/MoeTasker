// lib/utils/schedulerHelpers.js
import { sendMessage } from "@/utils/telegram"; // Ajusta la ruta si es necesario
import * as TaskManager from "@/lib/services/taskManager";
import { escapeHTML, bold, italic, code, mention, link } from '@/lib/utils/htmlEscaper';
import * as MoeHandler from "@/lib/services/moeHandler";

export async function triggerDailyReminders() {
  console.log(`[${new Date().toISOString()}] SCHEDULER: Ejecutando recordatorios diarios...`);
  const pendingTasks = await TaskManager.getTasksForDailyReminder();

  if (!pendingTasks || pendingTasks.length === 0) {
    console.log("SCHEDULER: No hay tareas pendientes para recordar.");
    return;
  }

  for (const task of pendingTasks) {
    const userMention = `<a href="tg://user?id=${task.assigned_to_id}">${escapeHTML(task.assigned_to_name)}</a>`;
    const completeCommand = `/completar_${task.id}`; 
    const messageText =
        `📢 *Recordatorio de Tarea Pendiente*\n\n` +
        `🔔 Tarea: ${escapeHTML(task.description)}\n` +
        `👤 Asignada a: ${userMention}\n` +
        `🆔 ID Tarea: \`${task.id}\`\n\n` + // Código
        `¡No olvides completarla! Usa \`${completeCommand}\``; // Código

    try {
      if (task.chat_id) {
        await sendMessage(task.chat_id, messageText, "HTML");
        console.log(`SCHEDULER: Recordatorio enviado para tarea ${task.id} a chat ${task.chat_id}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Pequeña pausa
      }
    } catch (error) {
      console.error(`SCHEDULER: Error al enviar recordatorio para tarea ${task.id}:`, error);
    }
  }
}


function getRandomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)) + MIN_DELAY_MS;
}



export async function triggerRandomFunMessage() {
  if (Math.random()>0.05) return;

  // Enviar mensaje
  const chatId = parseInt(process.env.TARGET_GROUP_ID || "");
  if (!chatId) return;

  const messageToSend = MoeHandler.getRandomPhraseForScheduler(); // Ya escapado
  await sendMessage(chatId, messageToSend, "HTML");

  // Calcular próximo tiempo aleatorio
  nextExecutionTimestamp = now + getRandomDelay();
}