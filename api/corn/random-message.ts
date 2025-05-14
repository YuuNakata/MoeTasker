// api/cron/random-message.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../../src/bot'; // Ajusta la ruta
import { sendRandomFunMessage } from '../../src/utils/schedulerHelpers'; // Ajusta la ruta

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Opcional: Protección con secret
  // if (request.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
  //   return response.status(401).send('Unauthorized');
  // }

  try {
    console.log("CRON JOB: Iniciando envío de mensaje aleatorio...");
    await sendRandomFunMessage(bot); // Pasa la instancia del bot
    console.log("CRON JOB: Envío de mensaje aleatorio completado.");
    response.status(200).send('Random message job executed successfully.');
  } catch (error: any) {
    console.error("CRON JOB: Error en el job de mensaje aleatorio:", error);
    response.status(500).send(`Error executing random message job: ${error.message}`);
  }
}