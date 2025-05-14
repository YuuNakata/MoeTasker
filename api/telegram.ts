// api/telegram.ts
// Este archivo se ubicará en el directorio /api de tu proyecto Vercel
// y Vercel lo convertirá en una función serverless accesible en /api/telegram

import { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookHandler, setupWebhook } from '../src/bot'; // Ajusta la ruta según tu estructura

// Configurar el webhook una vez (esto es un poco problemático aquí, idealmente se hace en un script de despliegue)
// Una forma es tener un endpoint GET que lo active, o hacerlo manualmente.
// O llamar a setupWebhook() solo si un token específico se pasa en la request.
// Por ahora, lo comentaremos aquí, asumiendo que el webhook se configura por separado.
/*
let webhookSetupDone = false;
async function ensureWebhook() {
    if (!webhookSetupDone && process.env.NODE_ENV === 'production') {
        try {
            await setupWebhook();
            webhookSetupDone = true;
        } catch (e) {
            console.error("Error setting up webhook in ensureWebhook:", e);
        }
    }
}
*/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // await ensureWebhook(); // Asegurar que el webhook esté configurado

  if (req.method === 'POST') {
    try {
      // Telegraf tiene un helper para manejar la request/response de Vercel
      // pero webhookHandler ya está preparado para ser un listener de http.
      // Simplemente pasamos la request y response al handler de Telegraf.
      // Necesitamos un truco para que Telegraf procese bien el body JSON
      // El `webhookHandler` exportado de `bot.ts` es un listener de `(req, res)`
      // cuando usas `bot.webhookCallback('/some/path')`.
      
      // Telegraf espera un objeto de actualización en req.body
      // Vercel ya parsea el JSON si el Content-Type es application/json
      return webhookHandler(req, res); // Llama al callback generado por Telegraf

    } catch (e: any) {
      console.error('Error en el handler del webhook:', e.message);
      res.status(500).send(`Error: ${e.message}`);
    }
  } else if (req.method === 'GET') {
    // Opcional: Endpoint GET para verificar o configurar el webhook
    try {
        const url = await setupWebhook(); // Intenta configurar si se llama con GET
        if (url) {
            res.status(200).send(`Webhook setup/verified. Listening at ${url}. Send POST requests here from Telegram.`);
        } else {
            res.status(200).send(`Webhook domain not configured. Bot might be in polling mode or webhook needs manual setup.`);
        }
    } catch (e:any) {
        res.status(500).send(`Error setting webhook via GET: ${e.message}`);
    }
  }
   else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end('Method Not Allowed');
  }
}