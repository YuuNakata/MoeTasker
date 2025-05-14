// api/cron/daily-reminder.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../../src/bot'; // Ajusta la ruta a tu archivo bot.ts
import { sendDailyReminders } from '../../src/utils/schedulerHelpers'; // Ajusta la ruta

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Opcional: Añadir un "secret" para proteger este endpoint si es público
  // if (request.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
  //   return response.status(401).send('Unauthorized');
  // }

  try {
    console.log("CRON JOB: Iniciando envío de recordatorios diarios...");
    await sendDailyReminders(bot); // Pasa la instancia del bot
    console.log("CRON JOB: Envío de recordatorios diarios completado.");
    response.status(200).send('Daily reminders job executed successfully.');
  } catch (error: any) {
    console.error("CRON JOB: Error en el job de recordatorios diarios:", error);
    response.status(500).send(`Error executing daily reminders job: ${error.message}`);
  }
}