// lib/services/oracleManager.js
import { query } from '@/lib/db';
import { escapeHTML } from '@/lib/utils/htmlEscaper';
import { getRandomKaomoji } from '@/lib/services/moeHandler'; // Solo necesitamos kaomoji aquí

const BOT_USERNAME = process.env.BOT_USERNAME;

// Umbral de similitud (0.0 a 1.0). Ajusta este valor según tus pruebas.
// Un valor más alto es más estricto. Para typos, 0.3 - 0.5 podría ser un buen inicio.
const SIMILARITY_THRESHOLD = 0.3; // ¡Experimenta con este valor!

export async function storeMessageForOracle(messageObject) {
  if (!messageObject || !messageObject.text || messageObject.text.trim() === "") {
    return { success: false, message: "Mensaje vacío o sin texto." };
  }
  if (messageObject.from && messageObject.from.is_bot && messageObject.from.username === BOT_USERNAME) {
    return { success: false, message: "Mensaje del propio bot, ignorado." };
  }
  if (messageObject.text.startsWith('/')) {
    return { success: false, message: "Es un comando, ignorado." };
  }
  const { chat, message_id, from, text } = messageObject;
  try {
    const result = await query(
      `INSERT INTO oracle_phrases (chat_id, message_id, user_id, user_first_name, text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING id`,
      [chat.id, message_id, from.id, from.first_name, text]
    );
    if (result.rowCount > 0) {
      return { success: true, id: result.rows[0].id };
    }
    return { success: false, message: "Mensaje ya existente o no guardado." };
  } catch (error) {
    console.error("OracleManager Error (storeMessageForOracle):", error);
    return { success: false, message: "Error al guardar mensaje para el oráculo." };
  }
}

export async function saveOracleDecision(chatId, messageId, userId, userFirstName, decisionText) {
  if (!decisionText || decisionText.trim() === "") {
    return { success: false, message: `¡Nya~! La decisión no puede estar vacía, ¿verdad? ${getRandomKaomoji()}` };
  }
  try {
    const result = await query(
      `INSERT INTO oracle_phrases (chat_id, message_id, user_id, user_first_name, text, is_decision)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (message_id) DO UPDATE SET 
         text = EXCLUDED.text, 
         is_decision = TRUE, 
         user_id = EXCLUDED.user_id, 
         user_first_name = EXCLUDED.user_first_name
       RETURNING id`,
      [chatId, messageId, userId, userFirstName, decisionText.trim()]
    );
    if (result.rowCount > 0) {
      return { success: true, id: result.rows[0].id, message: `🔮 ¡Entendido, sempai! Tu sabia decisión ha sido grabada en el Akasha del Oráculo~ ${getRandomKaomoji()}` };
    }
    return { success: false, message: `Uguu~ Algo no salió bien al guardar la decisión... ${getRandomKaomoji()}` };
  } catch (error) {
    console.error("OracleManager Error (saveOracleDecision):", error);
    return { success: false, message: `¡Kyaa! Un error salvaje apareció al guardar la decisión. ${getRandomKaomoji()}` };
  }
}

export async function getRecentMessages(chatId, limit = 10) {
  const botUsername = process.env.BOT_USERNAME || 'MoeTasker';
  try {
    const result = await query(
      `SELECT text, user_first_name
       FROM oracle_phrases
       WHERE chat_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [chatId, limit]
    );

    // Los mensajes vienen en orden descendente, los invertimos para el historial
    const messages = result.rows.reverse().map(row => ({
      text: row.text,
      // Asumimos que si el nombre de usuario coincide con el del bot, es un mensaje del bot
      // Esto es una simplificación. Una columna 'is_bot' en la BD sería más robusto.
      is_bot: row.user_first_name === botUsername 
    }));

    return messages;

  } catch (error) {
    console.error("OracleManager Error (getRecentMessages):", error);
    return []; // Devolver un array vacío en caso de error
  }
}

export async function queryOracle(questionText) {
  const thinkingKaomoji = getRandomKaomoji();

  if (!questionText || questionText.trim() === "") {
    return `El Oráculo ladea la cabeza... Necesita una preguntita para poder pensar, ¿sabes? ${thinkingKaomoji}`;
  }

  // La pregunta completa se usará para la similitud.
  // pg_trgm funciona mejor con cadenas de al menos unas pocas palabras.
  // Para búsquedas muy cortas (1-2 palabras con typos), Levenshtein podría ser mejor,
  // pero pg_trgm es más general.

  try {
    // Primero, buscamos decisiones que coincidan con buena similitud
    let result = await query(
      `SELECT text, user_first_name, created_at, similarity(text, $1) AS sml
       FROM oracle_phrases
       WHERE is_decision = TRUE AND similarity(text, $1) >= $2
       ORDER BY sml DESC, created_at DESC
       LIMIT 1`,
      [questionText, SIMILARITY_THRESHOLD]
    );

    let foundSource = "una antigua y súper importante decisión";
    let foundType = "decision";

    // Si no hay decisiones suficientemente similares, buscamos en todas las frases
    if (result.rowCount === 0) {
      result = await query(
        `SELECT text, user_first_name, created_at, similarity(text, $1) AS sml
         FROM oracle_phrases
         WHERE similarity(text, $1) >= $2
         ORDER BY sml DESC, created_at DESC
         LIMIT 1`,
        [questionText, SIMILARITY_THRESHOLD]
      );
      foundSource = "un susurro del pasado, ¡como un eco!";
      foundType = "echo";
    }

    if (result.rowCount > 0) {
      const consejo = result.rows[0];
      const autor = consejo.user_first_name ? escapeHTML(consejo.user_first_name) : "Alguien muy especial";
      const fecha = new Date(consejo.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      const sparkleKaomoji = getRandomKaomoji();
      // const similitudMostrada = (consejo.sml * 100).toFixed(0); // Opcional: mostrar similitud
      
      let prefixMessage = "";
      if (foundType === "decision") {
        prefixMessage = `¡Ah! El Oráculo recuerda con brillitos en los ojos ${foundSource}... ✨ Sucedió el ${fecha}, cuando el/la genial ${autor} proclamó con determinación:\n`;
      } else {
        prefixMessage = `Escucha, escucha~ िलंEl Oráculo ha captado ${foundSource}... Parece que el ${fecha}, ${autor} compartió esta perlita de sabiduría:\n`;
      }
      
      // return `${prefixMessage}"${escapeHTML(consejo.text.trim())}" (Similitud: ${similitudMostrada}%) \n\n¡Espero que esto te ilumine el camino! ${sparkleKaomoji}`;
      return `${prefixMessage}"${escapeHTML(consejo.text.trim())}"\n\n¡Espero que esto te ilumine el camino! ${sparkleKaomoji}`;

    } else {
      const sadKaomoji = getRandomKaomoji();
      // Ya no necesitamos dividir por keywords para el mensaje de "no encontrado"
      const respuestasGenericasMoe = [
        `Uguu~ El Oráculo ha buscado por todas partes, ¡pero no encuentra nada suficientemente parecido! ${sadKaomoji} ¿Quizás con otras palabritas o una frase más larga?`,
        `Las estrellitas no me dicen nada esta vez... Intenta preguntar de una forma más kawaii y clara, ¿siii? ⭐ ${thinkingKaomoji}`,
        `Moe-Moe-Kyun!~ El Oráculo está recargando su energía moe... Mientras, ¿por qué no pruebas otra cosita? ⚡ ${getRandomKaomoji()}`,
        `Kyaa~ ¡Tu pregunta es un misterio! ${getRandomKaomoji()} El Oráculo necesita más pistas o una pregunta más parecida a lo que busca.`,
        `El Oráculo se sonroja (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) y susurra: "No encontré nada que se parezca mucho... gomen ne".`
      ];
      return respuestasGenericasMoe[Math.floor(Math.random() * respuestasGenericasMoe.length)];
    }
  } catch (error) {
    console.error("OracleManager Error (queryOracle):", error);
    const errorKaomoji = getRandomKaomoji();
    return `¡DAIJOUBU JANAI! Σ(°ロ°)! Hubo un problemita técnico con el Oráculo... ¡Gomen nasai! ${errorKaomoji} Inténtalo más tarde, ¿vale?`;
  }
}