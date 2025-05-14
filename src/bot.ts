// src/bot.ts
import { Telegraf, Markup, Context } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config(); // Cargar variables de .env

import * as TaskManager from './services/taskManager';
import * as MoeHandler from './services/moeHandler';
// Las funciones de schedulerHelpers se llamarían desde endpoints de cron, no directamente aquí en un bucle.

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('FATAL_ERROR: TELEGRAM_BOT_TOKEN no está definido en las variables de entorno.');
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// --- Middlewares (opcional, para logging o pre-procesamiento) ---
bot.use(async (ctx, next) => {
  const startTime = Date.now();
  await next(); // Ejecutar los siguientes handlers
  const ms = Date.now() - startTime;
  if (ctx.message || ctx.callbackQuery) {
    const messageType = ctx.message ? 'message' : 'callback_query';
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : 'N/A');
    console.log(`[${new Date().toISOString()}] Update type: ${messageType}, From: ${ctx.from?.username || ctx.from?.id}, Text: "${text}", Response time: ${ms}ms`);
  }
});


// --- Comandos ---
bot.start((ctx) => {
  const senderName = ctx.from.first_name || 'estimado usuario';
  const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
  ctx.replyWithMarkdown( // Telegraf usa MarkdownV2 por defecto con este helper
    `¡Hola ${senderName}! Soy el bot de gestión de proyectos. ${kaomoji}\n` +
    "Usa `/asignar <Tarea 1>, <Tarea 2>, ...` para distribuir trabajo.\n" +
    "Usa `/tareas` para ver las tareas pendientes.\n" +
    "Usa `/completar <id\\_tarea>` o `/completar\\_<id\\_tarea>` para marcar una tarea como hecha.\n" + // Escapar '_' para MarkdownV2
    `Usa \`/frase\` para una dosis de ánimo. ${phrase.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')}` // Escapar caracteres especiales para frase
  );
});

bot.command('asignar', async (ctx) => {
  // ctx.payload contiene el texto después del comando
  const taskDescriptionsText = ctx.payload;
  if (!taskDescriptionsText) {
    return ctx.reply("Por favor, proporciona las tareas después del comando. Ejemplo: `/asignar Tarea A, Tarea B`");
  }
  const taskDescriptions = taskDescriptionsText.split(',').map(desc => desc.trim()).filter(Boolean);

  if (!taskDescriptions.length) {
    return ctx.reply("Debes proporcionar al menos una descripción de tarea válida.");
  }

  // Simulación de "transparencia"
  const assignMessage = await ctx.reply("🎲 Iniciando asignación de tareas...");
  const diceMessage = await ctx.sendDice({ emoji: '🎲' }); // Enviar un dado y guardar el mensaje
  // Opcional: esperar a que la animación del dado termine (aprox. 3 segundos)
  await new Promise(resolve => setTimeout(resolve, 3500));
  
  const result = await TaskManager.assignTasks(ctx.chat.id, taskDescriptions);
  await ctx.replyWithMarkdown(result.message);
  

  if (diceMessage && assignMessage) {
      await ctx.deleteMessage(assignMessage.message_id);
    await ctx.deleteMessage(diceMessage.message_id);
  }
  
});

bot.command('tareas', async (ctx) => {
  const summary = await TaskManager.getPendingTasksSummary();
  await ctx.replyWithMarkdown(summary);
});

// Para /completar ID y /completar_ID
// Telegraf usa expresiones regulares para `hears`.
bot.hears(/^\/completar(?:_|\s+)(\w+)/, async (ctx) => {
  const taskId = ctx.match[1]; // El grupo capturado por la regex
  const senderId = ctx.from.id;
  const response = await TaskManager.completeTask(taskId, senderId);
  await ctx.replyWithMarkdown(response);
});

bot.command(['frase', 'relax'], (ctx) => {
  const { phrase, kaomoji } = MoeHandler.getRandomFunPhrase();
  const escapedPhrase = phrase.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1'); // Escapar para MarkdownV2
  ctx.replyWithMarkdown(`${escapedPhrase} ${kaomoji}`);
});

// --- Manejo de mensajes generales para Moe ---
bot.on('text', async (ctx) => {
  // Evitar que responda a sus propios comandos si no fueron manejados antes
  if (ctx.message.text.startsWith('/')) {
      const command = ctx.message.text.split(' ')[0];
      const knownCommands = ['/start', '/asignar', '/tareas', '/completar', '/frase', '/relax'];
      if (knownCommands.includes(command) || command.startsWith('/completar_')) {
          return; // Ya fue (o será) manejado
      }
  }

  const moeResponse = MoeHandler.getMoeResponse(ctx.message.text);
  if (moeResponse) {
    // Escapar caracteres para MarkdownV2 si moeResponse los puede contener
    const escapedMoeResponse = moeResponse.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    await ctx.replyWithMarkdown(escapedMoeResponse);
  }
});

// --- Manejo de Errores Global ---
bot.catch((err, ctx) => {
  console.error(`Ooops, ocurrió un error para ${ctx.updateType}`, err);
  // Podrías enviar un mensaje genérico al usuario si es apropiado
  // ctx.reply('Lo siento, algo salió mal. Inténtalo de nuevo más tarde.');
});


// --- Configuración de Webhook (para Vercel) ---
// La URL del webhook se configurará una vez con Telegram,
// ya sea manualmente o con un script de despliegue.
// Vercel usa la variable de entorno VERCEL_URL
const WEBHOOK_DOMAIN = process.env.VERCEL_URL || process.env.WEBHOOK_DOMAIN;

export const setupWebhook = async () => {
  if (WEBHOOK_DOMAIN) {
    const webhookUrl = `https://${WEBHOOK_DOMAIN}/api/telegram`; // El path de tu función serverless
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook configurado en: ${webhookUrl}`);
    return webhookUrl;
  } else {
    console.warn('WEBHOOK_DOMAIN no está definido. No se puede configurar el webhook automáticamente. Ejecutando en modo polling para desarrollo.');
    return null;
  }
};

// Exportamos el handler para la función serverless
// Telegraf tiene un método `webhookCallback` que puedes usar.
// El path `/api/telegram` debe coincidir con el archivo en el directorio `api`.
export const webhookHandler = bot.webhookCallback(`/api/telegram`);


// --- Para desarrollo local con Polling (no usar en Vercel) ---
// Esta sección solo se ejecutaría si este archivo se corre directamente con Node.js
// y no estamos en un entorno que configure WEBHOOK_DOMAIN (como Vercel)
// if (require.main === module && !WEBHOOK_DOMAIN) {
//   console.log("Iniciando bot con polling para desarrollo local...");
//   bot.launch().then(() => {
//     console.log("Bot iniciado con polling.");
//   }).catch(err => {
//     console.error("Error al iniciar bot con polling:", err);
//   });

//   // Habilitar finalización elegante
//   process.once('SIGINT', () => bot.stop('SIGINT'));
//   process.once('SIGTERM', () => bot.stop('SIGTERM'));
// }