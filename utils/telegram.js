// utils/telegram.js
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;



export async function sendMessage(chatid, text, parseMode = "HTML") { // Añadido parseMode
    const url = `${TELEGRAM_API_URL}/sendMessage`;
    const body = {
        chat_id: chatid,
        text: text,
    };
    if (parseMode) {
        body.parse_mode = parseMode;
    }

    try {
        const response = await fetch(url, { // 'response' en minúscula
            method: "POST",
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!response.ok){ // 'response' en minúscula
            console.error("Failed to send message to telegram user. Status:", response.status, "Body:", await response.text());
        }
        return response; // Devolver la respuesta para poder obtener message_id
    } catch (err) {
        console.error("Error occured while sending message to telegram user", err);
        return null;
    }
}

export async function sendDice(chatid, emoji = "🎲") {
    const url = `${TELEGRAM_API_URL}/sendDice`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatid, emoji: emoji })
        });
        if (!response.ok) {
            console.error("Failed to send dice. Status:", response.status, "Body:", await response.text());
            return null;
        }
        return await response.json(); // Devuelve el objeto Message del dado
    } catch (err) {
        console.error("Error sending dice", err);
        return null;
    }
}

export async function deleteMessage(chatid, messageId) {
    const url = `${TELEGRAM_API_URL}/deleteMessage`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatid, message_id: messageId })
        });
        if (!response.ok) {
            console.error("Failed to delete message. Status:", response.status, "Body:", await response.text());
        }
        return response.ok;
    } catch (err) {
        console.error("Error deleting message", err);
        return false;
    }
}

// Podrías añadir editMessageText si lo necesitas
export async function editMessageText(chatid, messageId, text, parseMode = "HTML") {
    const url = `${TELEGRAM_API_URL}/editMessageText`;
    const body = {
        chat_id: chatid,
        message_id: messageId,
        text: text,
    };
    if (parseMode) {
        body.parse_mode = parseMode;
    }
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            console.error("Failed to edit message. Status:", response.status, "Body:", await response.text());
        }
        return response.ok;
    } catch (err) {
        console.error("Error editing message", err);
        return false;
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