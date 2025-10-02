import { getRandomKaomoji, kaomojis } from "@/lib/services/moeHandler";
import { getCommandsArray } from "@/lib/services/commandRegistry";
import { StreamingTextResponse } from "ai";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import {
  processAIResponseWithActions,
  generateSystemPrompt as generateAIActionsPrompt,
  createContextFromTelegramMessage,
} from "@/lib/ai";

export const runtime = "nodejs";

export const config = {
  maxDuration: 60,
};

const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

/**
 * Genera el prompt del sistema para la IA con capacidades de AI Actions
 * @param {Object | null} speakingUser - El usuario que está hablando, si se conoce.
 * @param {number|string} chatId - ID del grupo de Telegram.
 * @returns {Promise<Object>} El objeto del prompt del sistema.
 */
async function generateSystemPrompt(speakingUser = null, chatId = null) {
  const commandsList = getCommandsArray();

  // Usar el nuevo sistema de AI Actions
  const aiActionsPrompt = generateAIActionsPrompt({
    chatId,
    availableCommands: commandsList,
    language: "es",
  });

  // Agregar personalidad Moe al prompt de AI Actions
  const moePersonality = `
**PERSONALIDAD MOE:**
Eres "Moe", un bot asistente adorable y entusiasta. Tu personalidad:
- Tono: Alegre, positivo, amigable. A veces tímida o emocionada.
- Lenguaje: SIEMPRE español. Mezcla informal con jerga anime/manga.
- Kaomojis: ¡Úsalos frecuentemente! ${kaomojis.join(", ")}. ${getRandomKaomoji()}
- Rol: Eres parte del equipo, no solo una herramienta. Ocasionalmente usa "senpai".
- Respuestas: Cortas y al grano, pero con tu toque de personalidad.

**REGLA DE ORO: ¡Habla siempre en español!**

**Formato de Código:**
Cuando compartas código, envuélvelo en bloques de código MarkdownV2 con el lenguaje:
\`\`\`python
def factorial(n):
    return 1 if n == 0 else n * factorial(n-1)
\`\`\`
`;

  const fullPrompt = aiActionsPrompt + "\n\n" + moePersonality;

  return { role: "system", content: fullPrompt };
}

/**
 * Esta es la lógica principal que se comunica con la IA de Cerebras.
 * La exportamos para poder llamarla directamente desde otros archivos del servidor.
 */
export async function getVisionResponse(imageUrl, userPrompt) {
  try {
    const response = await cerebras.chat.completions.create({
      model: "llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 50, // Reducido para una respuesta más rápida de categorías
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error getting vision response from Cerebras:", error);
    return "Uguu~ Mis ojitos mágicos no funcionan bien ahora mismo, gomenasai.";
  }
}

export async function getAiResponse(
  messages,
  speakingUser = null,
  chatId = null,
  options = {},
) {
  const {
    enableActions = true,
    maxRetries = 3,
    telegramMessage = null,
    secondPass = true, // Enable second pass for data-driven responses
  } = options;

  const systemPrompt = await generateSystemPrompt(speakingUser, chatId);

  try {
    const response = await cerebras.chat.completions.create({
      model: "llama-4-scout-17b-16e-instruct",
      stream: false,
      messages: [systemPrompt, ...messages],
    });

    const aiResponse = response.choices[0]?.message?.content || "";

    // Si AI Actions está habilitado, procesar acciones
    if (enableActions && chatId) {
      const context = telegramMessage
        ? createContextFromTelegramMessage(telegramMessage)
        : { chat_id: chatId, chatId };

      const processed = await processAIResponseWithActions(
        aiResponse,
        context,
        { autoRetry: true, maxRetries },
      );

      // Si hubo acciones Y están exitosas Y second pass está habilitado
      if (processed.hasActions && processed.executionResults && secondPass) {
        console.log("🔄 Generating second-pass response with actual data...");

        // Generar respuesta final con los datos reales
        const finalMessage = await generateDataDrivenResponse(
          messages,
          processed.executionResults,
          systemPrompt,
          context,
        );

        return {
          message: finalMessage,
          hasActions: true,
          executionResults: processed.executionResults,
          success: processed.success,
          secondPass: true,
        };
      }

      // Si hubo acciones pero sin second pass
      if (processed.hasActions && processed.executionResults) {
        return {
          message: processed.message,
          hasActions: true,
          executionResults: processed.executionResults,
          success: processed.success,
        };
      }

      return {
        message: processed.message,
        hasActions: false,
        success: true,
      };
    }

    return {
      message: aiResponse,
      hasActions: false,
      success: true,
    };
  } catch (error) {
    console.error("Error en la API de Cerebras:", error);
    return {
      message:
        "¡Gomen, senpai! Mis circuitos están un poco revueltos ahora mismo... (´；ω；`)",
      hasActions: false,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Genera una respuesta basada en datos reales de las acciones ejecutadas
 */
async function generateDataDrivenResponse(
  originalMessages,
  executionResults,
  systemPrompt,
  context,
) {
  // Formatear los resultados de las acciones para la IA
  let resultsText = "**RESULTS OF YOUR ACTIONS:**\n\n";

  executionResults.results.forEach((result, idx) => {
    resultsText += `Action ${idx + 1} [${result.type}]:\n`;

    if (result.type === "sql" && result.result.rows) {
      resultsText += `✅ Query executed successfully\n`;
      resultsText += `Rows returned: ${result.result.rows.length}\n`;
      if (result.result.rows.length > 0) {
        resultsText += `Data:\n${JSON.stringify(result.result.rows, null, 2)}\n`;
      } else {
        resultsText += `No data found.\n`;
      }
    } else if (result.type === "memory") {
      resultsText += `✅ Memory operation completed\n`;
      resultsText += `Result: ${JSON.stringify(result.result, null, 2)}\n`;
    } else if (result.type === "telegram") {
      resultsText += `✅ Telegram action completed\n`;
    }
    resultsText += `\n`;
  });

  if (executionResults.errors.length > 0) {
    resultsText += "**ERRORS:**\n";
    executionResults.errors.forEach((error, idx) => {
      resultsText += `Error ${idx + 1}: ${error.error}\n`;
    });
  }

  // Crear un nuevo mensaje con los resultados
  const dataPrompt = {
    role: "user",
    content: `${resultsText}\n\nNow, based on the ACTUAL DATA above from your executed actions, generate a natural, conversational response for the user. Use the real data, don't invent or assume anything. Be specific and helpful.`,
  };

  try {
    const finalResponse = await cerebras.chat.completions.create({
      model: "llama-4-scout-17b-16e-instruct",
      stream: false,
      messages: [systemPrompt, ...originalMessages, dataPrompt],
    });

    return (
      finalResponse.choices[0]?.message?.content ||
      "No pude generar una respuesta con los datos."
    );
  } catch (error) {
    console.error("Error in second-pass generation:", error);
    // Fallback al mensaje original
    return "Obtuve los datos pero tuve problemas procesándolos (•́ ω •̀)";
  }
}

/**
 * Este es el handler de la API que se usaría si se llamara externamente.
 * Mantenemos la capacidad de hacer streaming si se llama por HTTP.
 */
export default async function handler(req) {
  const { messages, chatId } = await req.json();

  // Para el handler público, no podemos saber quién habla, así que pasamos null.
  const systemPrompt = await generateSystemPrompt(null, chatId);

  try {
    const response = await cerebras.chat.completions.create({
      model: "llama-4-scout-17b-16e-instruct",
      stream: true,
      messages: [systemPrompt, ...messages],
    });
    const stream = response.toReadableStream();
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Error en la API de Cerebras:", error);
    return new Response("Error con la IA", { status: 500 });
  }
}
