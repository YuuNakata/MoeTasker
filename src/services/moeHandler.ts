// src/services/moeHandler.ts
import fs from 'fs';
import path from 'path';
import { FunPhrases } from '../types';

const PHRASES_FILE_PATH = path.join(__dirname, '../../data/fun_phrases.json');

let funPhrases: FunPhrases = {
  general_encouragement: ["¡Ánimo equipo! ✨"],
  kaomoji_expressions: ["(＾▽＾)"],
  developer_humor: ["Error 404: Chiste not found... 😉"],
  moe_responses: ["Nya~ :3"]
};

try {
  const rawData = fs.readFileSync(PHRASES_FILE_PATH, 'utf-8');
  const loadedPhrases = JSON.parse(rawData) as FunPhrases;
  // Simple validación para asegurar que las claves principales existen
  for (const key in funPhrases) {
    if (loadedPhrases[key as keyof FunPhrases]?.length) {
      funPhrases[key as keyof FunPhrases] = loadedPhrases[key as keyof FunPhrases];
    }
  }
  console.log("Frases divertidas cargadas exitosamente.");
} catch (error) {
  console.error("Error al cargar fun_phrases.json, usando valores por defecto:", error);
}

const MOE_TRIGGERS_REGEX = [/(?:^|\s)(uwu|owo|:\s*3|nya|ñya)(?:$|\s)/i];

export function getMoeResponse(text: string): string | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const triggerRegex of MOE_TRIGGERS_REGEX) {
    if (triggerRegex.test(lowerText)) {
      const response = funPhrases.moe_responses[Math.floor(Math.random() * funPhrases.moe_responses.length)];
      const kaomoji = funPhrases.kaomoji_expressions[Math.floor(Math.random() * funPhrases.kaomoji_expressions.length)];
      return `${response} ${kaomoji}`;
    }
  }
  return null;
}

export function getRandomFunPhrase(): { phrase: string, kaomoji: string } {
  const allPurposePhrases = [
    ...funPhrases.general_encouragement,
    ...funPhrases.developer_humor,
  ];
  if (!allPurposePhrases.length) { // Fallback
      return { phrase: "¡Que tengas un buen día!", kaomoji: funPhrases.kaomoji_expressions[0] || "(^-^)"};
  }

  const phrase = allPurposePhrases[Math.floor(Math.random() * allPurposePhrases.length)];
  const kaomoji = funPhrases.kaomoji_expressions[Math.floor(Math.random() * funPhrases.kaomoji_expressions.length)];
  return { phrase, kaomoji };
}

export function getRandomPhraseForScheduler(): string {
    const { phrase, kaomoji } = getRandomFunPhrase();
    return `${phrase} ${kaomoji}`;
}