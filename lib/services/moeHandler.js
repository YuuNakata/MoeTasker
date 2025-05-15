// lib/services/moeHandler.js
import fs from 'fs';
import path from 'path';


import { escapeHTML, bold, italic, code } from '@/lib/utils/htmlEscaper';

// Para escapar Markdown (simple, si no quieres usar una librería)
// Telegram espera MarkdownV2 o HTML. Dado que sendMessage no especifica parse_mode,
// el formato por defecto podría ser limitado. Para enlaces y negritas, necesitarás parse_mode.
// Vamos a asumir que sendMessage se modificará para aceptar parse_mode.
export function escapeMarkdownV2(text) {
  if (typeof text !== 'string') return '';
  // _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

const STICKERS_FILE_PATH = path.join(process.cwd(), 'data', 'reply_stickers.json');
let replyStickerFileIds = [];




let funPhrases = {
  general_encouragement: ["¡Ánimo equipo! ✨"],
  kaomoji_expressions: ["(＾▽＾)"],
  developer_humor: ["Error 404: Chiste not found... 😉"],
  moe_responses: ["Nya~ :3"]
};

try {
  if (fs.existsSync(STICKERS_FILE_PATH)) {
    const rawData = fs.readFileSync(STICKERS_FILE_PATH, 'utf-8');
    const loadedStickers = JSON.parse(rawData);
    if (Array.isArray(loadedStickers) && loadedStickers.length > 0) {
      replyStickerFileIds = loadedStickers;
      console.log(`MoeHandler: ${replyStickerFileIds.length} stickers de respuesta cargados.`);
    } else {
      console.warn(`MoeHandler: reply_stickers.json está vacío o no es un array.`);
    }
  } else {
    console.warn(`MoeHandler: reply_stickers.json no encontrado en ${STICKERS_FILE_PATH}. No se enviarán stickers de respuesta.`);
  }
} catch (error) {
  console.error("MoeHandler: Error al cargar reply_stickers.json:", error);
}

const PHRASES_FILE_PATH = path.join(process.cwd(), 'data', 'fun_phrases.json');

try {
  if (fs.existsSync(PHRASES_FILE_PATH)) {
    const rawData = fs.readFileSync(PHRASES_FILE_PATH, 'utf-8');
    const loadedPhrases = JSON.parse(rawData);
    for (const key in funPhrases) {
      if (loadedPhrases[key] && Array.isArray(loadedPhrases[key]) && loadedPhrases[key].length > 0) {
        funPhrases[key] = loadedPhrases[key];
      }
    }
    console.log("MoeHandler: Frases divertidas cargadas exitosamente.");
  } else {
    console.warn(`MoeHandler: fun_phrases.json no encontrado en ${PHRASES_FILE_PATH}, usando valores por defecto.`);
  }
} catch (error) {
  console.error("MoeHandler: Error al cargar fun_phrases.json:", error);
}

const MOE_TRIGGERS_REGEX = [/(?:^|\s)(uwu|owo|:\s*3|nya|ñya)(?:$|\s)/i];

export function getMoeResponse(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const triggerRegex of MOE_TRIGGERS_REGEX) {
    if (triggerRegex.test(lowerText)) {
      const response = funPhrases.moe_responses[Math.floor(Math.random() * funPhrases.moe_responses.length)];
      const kaomoji = funPhrases.kaomoji_expressions[Math.floor(Math.random() * funPhrases.kaomoji_expressions.length)];
      return `${escapeHTML(response)} ${escapeHTML(kaomoji)}`;
    }
  }
  return null;
}

export function getRandomFunPhrase() {
  const allPurposePhrases = [
    ...funPhrases.general_encouragement,
    ...funPhrases.developer_humor,
  ];
  let phrase;
  if (!allPurposePhrases.length) {
    phrase = "¡Que tengas un buen día!";
  } else {
    phrase = allPurposePhrases[Math.floor(Math.random() * allPurposePhrases.length)];
  }

  const kaomoji = funPhrases.kaomoji_expressions[Math.floor(Math.random() * funPhrases.kaomoji_expressions.length)] || "(^-^)";
  return { phrase: escapeHTML(phrase), kaomoji: escapeHTML(kaomoji) };
}

export function getRandomPhraseForScheduler() {
    const { phrase, kaomoji } = getRandomFunPhrase();
    return `${escapeHTML(phrase)} ${escapeHTML(kaomoji)}`;
}

export function getHelpMessage(senderName) {
    const { phrase, kaomoji } = getRandomFunPhrase(); // phrase ya viene escapada de esta función
    
    const escapedSenderName = bold(senderName); // Escapar y poner en negrita el nombre
  
    return (
      `¡Hola ${escapedSenderName}! Soy el bot MoeTasker. ${escapeHTML(kaomoji)}\n\n` + // Escapar kaomoji
      `Usa ${code('/asignar <Tarea 1>, <Tarea 2>, ...')} para distribuir trabajo.\n` +
      `Usa ${code('/tareas')} para ver las tareas pendientes.\n` +
      `Usa ${code('/completar SU_ID_DE_TAREA')} o ${code('/completar_SU_ID_DE_TAREA')} para marcar una tarea como hecha.\n` +
      `Usa ${code('/frase')} para una dosis de ánimo.\n` +
      `Usa ${code('/trabajo')} respondiendo a un .doc/.docx para fijarlo, o solo para ver el trabajo fijado.\n\n` + 
      `<i>Frase del día:</i> ${phrase}` // phrase ya está escapada
    );
  }

  
  export function getRandomReplySticker() {
    if (replyStickerFileIds.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * replyStickerFileIds.length);
    return replyStickerFileIds[randomIndex];
  }
  
  