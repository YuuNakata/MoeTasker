// utils/telegram.js
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;


async function handleTelegramResponse(response, context = {}) {
    if (!response) { // Error de fetch
        return { ok: false, error: "Network error or fetch failed", context };
    }

    let responseData = null;
    try {
        // Intenta parsear como JSON, ya que la API de Telegram suele devolver JSON
        responseData = await response.json();
    } catch (e) {
        // Si falla el parseo JSON, intenta leer como texto (para errores no JSON)
        try {
            responseData = await response.text();
        } catch (e2) {
            responseData = "Failed to read response body.";
        }
    }

    if (!response.ok) {
        console.error(
            `Telegram API Error: Status=${response.status}`,
            `Context=${JSON.stringify(context)}`,
            `Response Body=${typeof responseData === 'object' ? JSON.stringify(responseData) : responseData}`
        );
        // Devuelve la estructura del error de Telegram si está disponible
        return responseData && typeof responseData === 'object' ? responseData : { ok: false, status: response.status, description: responseData, context };
    }
    // console.log("Telegram API Success:", context, responseData);
    return responseData; // Suele ser { ok: true, result: { ... } }
}




export async function sendMessage(chatid, text, parseMode = "HTML") {
    const url = `${TELEGRAM_API_URL}/sendMessage`;
    const bodyPayload = { chat_id: chatid, text: text };
    if (parseMode) bodyPayload.parse_mode = parseMode;

    const context = { action: "sendMessage", chatid, textPreview: text.substring(0, 50) };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        return await handleTelegramResponse(response, context);
    } catch (err) {
        console.error("Error in sendMessage fetch:", err, context);
        return { ok: false, error: err.message, context };
    }
}


export async function sendDice(chatid, emoji = "🎲") {
    const url = `${TELEGRAM_API_URL}/sendDice`;
    const bodyPayload = { chat_id: chatid, emoji: emoji };
    const context = { action: "sendDice", chatid };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        // Loguear la respuesta de la API ANTES de handleTelegramResponse si es necesario
        // const rawResponseText = await response.text(); // Leer una vez
        // console.log("Raw sendDice API response text:", rawResponseText);
        // const data = JSON.parse(rawResponseText);
        // return handleTelegramResponse({ ...response, json: async () => data, text: async () => rawResponseText }, context);
        // Lo de arriba es si handleTelegramResponse espera un objeto response de fetch.
        // Pero si handleTelegramResponse ya hace el .json() o .text(), está bien como sigue:
        return await handleTelegramResponse(response, context);
    } catch (err) {
        console.error("Error in sendDice fetch:", err, context);
        return { ok: false, error: err.message, context };
    }
}

export async function deleteMessage(chatid, messageId) {
    const url = `${TELEGRAM_API_URL}/deleteMessage`;
    const bodyPayload = { chat_id: chatid, message_id: messageId };
    const context = { action: "deleteMessage", chatid, messageId };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        return await handleTelegramResponse(response, context);
    } catch (err) {
        console.error("Error in deleteMessage fetch:", err, context);
        return { ok: false, error: err.message, context };
    }
}


// Podrías añadir editMessageText si lo necesitas
export async function editMessageText(chatid, messageId, text, parseMode = "HTML") {
    const url = `${TELEGRAM_API_URL}/editMessageText`;
    const bodyPayload = { chat_id: chatid, message_id: messageId, text: text };
    if (parseMode) bodyPayload.parse_mode = parseMode;
    const context = { action: "editMessageText", chatid, messageId, textPreview: text.substring(0, 50) };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        return await handleTelegramResponse(response, context);
    } catch (err) {
        console.error("Error in editMessageText fetch:", err, context);
        return { ok: false, error: err.message, context };
    }
}

export async function forwardMessage(targetChatId, fromChatId, messageId) {
    const url = `${TELEGRAM_API_URL}/forwardMessage`;
    const body = {
        chat_id: targetChatId,
        from_chat_id: fromChatId,
        message_id: messageId,
        // disable_notification: true // Opcional
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            console.error(`Failed to forward message. TargetChat: ${targetChatId}, FromChat: ${fromChatId}, MsgID: ${messageId}. Status: ${response.status}, Body: ${await response.text()}`);
        }
        return response;
    } catch (err) {
        console.error("Error forwarding message:", err);
        return null;
    }
}

export async function sendDocumentByFileId(chatid, fileId, caption = null, parseMode = "HTML") {
    const url = `${TELEGRAM_API_URL}/sendDocument`;
    const body = {
        chat_id: chatid,
        document: fileId, // Enviar por file_id
    };
    if (caption) {
        body.caption = caption; // El caption ya debería estar escapado si es necesario
    }
    if (parseMode && caption) { // parseMode aplica al caption
        body.parse_mode = parseMode;
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            console.error(`Failed to send document by file_id. ChatID: ${chatid}, FileID: ${fileId}. Status: ${response.status}, Body: ${await response.text()}`);
        }
        return response;
    } catch (err) {
        console.error("Error sending document by file_id:", err);
        return null;
    }
}