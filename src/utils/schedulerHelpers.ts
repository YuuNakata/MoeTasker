// src/utils/schedulerHelpers.ts
import { Telegraf } from 'telegraf';
import { getTasksForDailyReminder } from '../services/taskManager';
import { getRandomPhraseForScheduler } from '../services/moeHandler';
import { Task } from '../types';

export async function sendDailyReminders(bot: Telegraf<any>) {
  console.log(`[${new Date().toISOString()}] Ejecutando recordatorios diarios...`);
  const pendingTasks: Task[] = await getTasksForDailyReminder();

  if (!pendingTasks.length) {
    console.log("No hay tareas pendientes para recordar.");
    return;
  }

  const remindersSentToChats = new Set<number>();

  for (const task of pendingTasks) {
    // Evitar spam si hay muchas tareas en un mismo chat para el mismo recordatorio
    if (remindersSentToChats.has(task.chat_id) && pendingTasks.filter(t => t.chat_id === task.chat_id).length > 3) {
        continue;
    }

    const userMention = `[${task.assigned_to_name}](tg://user?id=${task.assigned_to_id})`;
    const completeCommand = `/completar_${task.id}`;
    const message =
        `📢 **Recordatorio de Tarea Pendiente**\n\n` +
        `🔔 Tarea: ${task.description}\n` +
        `👤 Asignada a: ${userMention}\n` +
        `🆔 ID Tarea: \`${task.id}\`\n\n` +
        `¡No olvides completarla! Usa \`${completeCommand}\` cuando termines.`;
    try {
      // Enviar al chat donde se asignó la tarea
      if (task.chat_id) {
        await bot.telegram.sendMessage(task.chat_id, message, { parse_mode: 'MarkdownV2' });
        remindersSentToChats.add(task.chat_id);
        console.log(`Recordatorio enviado para tarea ${task.id} a chat ${task.chat_id}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Pequeña pausa
      } else {
        console.warn(`No se pudo enviar recordatorio para tarea ${task.id}: chat_id faltante.`);
      }
    } catch (error: any) {
      console.error(`Error al enviar recordatorio para tarea ${task.id}:`, error.message);
    }
  }
}

export async function sendRandomFunMessage(bot: Telegraf<any>) {
  const targetGroupId = parseInt(process.env.TELEGRAM_TARGET_GROUP_ID || '0');
  if (!targetGroupId) {
    console.warn("TELEGRAM_TARGET_GROUP_ID no configurado. No se enviará mensaje aleatorio.");
    return;
  }
  try {
    const messageToSend = getRandomPhraseForScheduler();
    await bot.telegram.sendMessage(targetGroupId, messageToSend);
    console.log(`Mensaje aleatorio enviado al grupo ${targetGroupId}: "${messageToSend}"`);
  } catch (error: any) {
    console.error("Error al enviar mensaje aleatorio al grupo:", error.message);
  }
}