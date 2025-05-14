// lib/services/moeHandler.js
import fs from 'fs';
import path from 'path';

// Para escapar Markdown (simple, si no quieres usar una librería)
// Telegram espera MarkdownV2 o HTML. Dado que sendMessage no especifica parse_mode,
// el formato por defecto podría ser limitado. Para enlaces y negritas, necesitarás parse_mode.
// Vamos a asumir que sendMessage se modificará para aceptar parse_mode.
const escapeMarkdownV2 = (text) => {
  if (typeof text !== 'string') return '';
  // _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};


const PHRASES_FILE_PATH = path.join(process.cwd(), 'data', 'fun_phrases.json');

let funPhrases = {
  general_encouragement: ["¡Ánimo equipo! ✨"],
  kaomoji_expressions: ["(＾▽＾)"],
  developer_humor: ["Error 404: Chiste not found... 😉"],
  moe_responses: ["Nya~ :3"]
};

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
      return `${escapeMarkdownV2(response)} ${kaomoji}`;
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
  return { phrase: escapeMarkdownV2(phrase), kaomoji };
}

export function getRandomPhraseForScheduler() {
    const { phrase, kaomoji } = getRandomFunPhrase();
    return `${phrase} ${kaomoji}`;
}