// src/dev-server.ts
// Este archivo es SOLO para desarrollo local, NO para Vercel.
// Usa long polling en lugar de webhooks.

import { bot } from './bot'; // Importa la instancia configurada del bot
import dotenv from 'dotenv';
dotenv.config();

console.log("Iniciando bot con polling para desarrollo local...");

bot.launch().then(() => {
  console.log("Bot iniciado y escuchando con polling.");
  console.log("Presiona Ctrl+C para detener.");
}).catch(err => {
  console.error("Error al iniciar bot con polling:", err);
  process.exit(1);
});

// Habilitar finalización elegante
process.once('SIGINT', () => {
  console.log("Deteniendo bot (SIGINT)...");
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log("Deteniendo bot (SIGTERM)...");
  bot.stop('SIGTERM');
  process.exit(0);
});