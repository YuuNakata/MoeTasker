// lib/utils/schedulerHelpers.js
import { sendMessage } from "@/utils/telegram"; // Ajusta la ruta si es necesario
import * as TaskManager from "@/lib/services/taskManager";
import { escapeHTML, bold, italic, code, mention, link } from '@/lib/utils/htmlEscaper';
import * as MoeHandler from "@/lib/services/moeHandler";


let nextExecutionTimestamp = null;

const MIN_DELAY_MS = 15 * 60 * 1000;       // 15 minutos
const MAX_DELAY_MS = 4 * 60 * 60 * 1000;   // 4 horas

export async function triggerDailyReminders() {
  console.log(`[${new Date().toISOString()}] SCHEDULER: Ejecutando recordatorios diarios...`);
  const pendingTasks = await TaskManager.getTasksForDailyReminder();

  if (!pendingTasks || pendingTasks.length === 0) {
    console.log("SCHEDULER: No hay tareas pendientes para recordar.");
    return;
  }

  for (const task of pendingTasks) {
    const userMention = `<a href="tg://user?id=${task.assigned_to_id}">${escapeHTML(task.assigned_to_name)}</a>`;
    const completeCommand = `/completar_${task.id}`; // Ya es código, no necesita escape extra
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

function getInitialNextTimestamp() {
  return Date.now() + getRandomDelay();
}

export async function triggerRandomFunMessage() {
  const now = Date.now();

  // Si el bot se reinicia y la variable se pierde, asigna un tiempo aleatorio inicial
  if (!nextExecutionTimestamp) {
    nextExecutionTimestamp = getInitialNextTimestamp();
    return;
  }

  // Aún no es hora
  if (now < nextExecutionTimestamp) return;

  // Enviar mensaje
  const chatId = parseInt(process.env.USER_ID_RAYDEL || "");
  if (!chatId) return;

  const messageToSend = MoeHandler.getRandomPhraseForScheduler(); // Ya escapado
  await sendMessage(chatId, messageToSend, "HTML");

  // Calcular próximo tiempo aleatorio
  nextExecutionTimestamp = now + getRandomDelay();
}