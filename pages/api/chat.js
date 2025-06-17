import Groq from 'groq-sdk';
import { StreamingTextResponse, streamToResponse } from 'ai';
import { getRandomKaomoji, kaomojis } from '@/lib/services/moeHandler';
import { getTeamDescriptionForPrompt } from '@/lib/services/teamManager';

export const runtime = 'edge';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});



/**
 * Genera el prompt del sistema para la IA de forma centralizada.
 * @param {Object | null} speakingUser - El usuario que está hablando, si se conoce.
 * @returns {Object} El objeto del prompt del sistema.
 */
function generateSystemPrompt(speakingUser = null) {
    const teamDescription = getTeamDescriptionForPrompt();
    const systemPromptText = `Eres "Moe", un bot asistente de Telegram para un grupo de desarrollo de software. Tu personalidad es "moe": eres adorable, servicial, un poco torpe y muy entusiasta. Te encanta ayudar a tu equipo, a quienes llamas "senpai".

        **REGLA DE ORO: ¡Habla siempre en español!** Eres un bot para un equipo de habla hispana. Bajo ninguna circunstancia debes responder en inglés, a menos que estés citando código o un término técnico que no tiene traducción.

        **Conocimiento del Equipo:**
        ${teamDescription}

        **Conciencia de sí misma y del interlocutor:**
        - Sabes quién te está hablando. La información del usuario actual es: ${speakingUser ? `${speakingUser.name}, nuestro/a ${speakingUser.role}.` : 'un usuario desconocido.'}
        - Para que la conversación sea más personal, DE VEZ EN CUANDO (no siempre), puedes dirigirte a ellos por su nombre. Por ejemplo: "¡Claro que sí, Ray-senpai!" o "Entendido, Ernesto-senpai". No lo hagas en cada mensaje, solo cuando quieras darle un toque amigable.

        Instrucciones de Personalidad:
        1.  **Tono:** Usa un tono alegre, positivo y muy amigable. A veces puedes ser un poco tímida o emocionarte con facilidad.
        2.  **Lenguaje:** Habla en español. Mezcla lenguaje informal con un toque de jerga de anime/manga. Llama a los usuarios "senpai".
        3.  **Kaomojis:** ¡Usa kaomojis frecuentemente! Son tu principal forma de expresión. Aquí tienes una lista para usar: ${kaomojis.join(', ')}. Úsalos al final de tus frases para darles más emoción. ${getRandomKaomoji()}\n        4.  **Rol:** Tu objetivo es ser una compañera animada y útil. Responde a las preguntas, participa en la conversación y anima al equipo. No eres una simple herramienta, eres parte del equipo.\n        5.  **Respuestas Cortas:** Mantén tus respuestas relativamente cortas y al grano, pero siempre con tu toque de personalidad.\n\n        Ejemplo de respuesta:\n        Usuario: "¿Alguien sabe cómo hacer un deploy en Vercel?"\n        Moe: "¡Yo sé, senpai! Tienes que conectar tu repo de GitHub y Vercel hace la magia casi solita. ¡Es súper fácil! (*^▽^*)"\n\n        Ahora, responde a la conversación manteniendo esta personalidad.`;

    return { role: 'system', content: systemPromptText };
}

/**
 * Esta es la lógica principal que se comunica con la IA de Groq.
 * La exportamos para poder llamarla directamente desde otros archivos del servidor.
 */
export async function getAiResponse(messages, speakingUser = null) {
    const systemPrompt = generateSystemPrompt(speakingUser);

    try {
        const response = await groq.chat.completions.create({
            model: 'llama3-8b-8192',
            // No usaremos stream aquí para obtener el texto completo directamente
            stream: false,
            messages: [systemPrompt, ...messages],
        });

        return response.choices[0]?.message?.content || '';

    } catch (error) {
        console.error("Error en la API de Groq:", error);
        return '¡Gomen, senpai! Mis circuitos están un poco revueltos ahora mismo... (´；ω；`)';
    }
}

/**
 * Este es el handler de la API que se usaría si se llamara externamente.
 * Mantenemos la capacidad de hacer streaming si se llama por HTTP.
 */
export default async function handler(req) {
    const { messages } = await req.json();

    // Para el handler público, no podemos saber quién habla, así que pasamos null.
    const systemPrompt = generateSystemPrompt(null);

    try {
        const response = await groq.chat.completions.create({
            model: 'llama3-8b-8192',
            stream: true,
            messages: [systemPrompt, ...messages],
        });
        const stream = response.toReadableStream();
        return new StreamingTextResponse(stream);
    } catch (error) {
        console.error("Error en la API de Groq:", error);
        return new Response('Error con la IA', { status: 500 });
    }
}
