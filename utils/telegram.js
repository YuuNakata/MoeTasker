// utils/telegram.js
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

export async function getFilePath(fileId) {
    const url = `${TELEGRAM_API_URL}/getFile`;
    const body = { file_id: fileId };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            console.error("Failed to get file path. Status:", response.status, "Body:", await response.text());
            return null;
        }
        const data = await response.json();
        return data.result.file_path;
    } catch (err) {
        console.error("Error occurred while getting file path", err);
        return null;
    }
}

export async function sendChatAction(chatId, action = 'typing') {
    const url = `${TELEGRAM_API_URL}/sendChatAction`;
    const body = {
        chat_id: chatId,
        action: action,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            console.error("Failed to send chat action. Status:", response.status, "Body:", await response.text());
        }
        return response;
    } catch (err) {
        console.error("Error occurred while sending chat action", err);
        return null;
    }
} // Cambiado a TELEGRAM_BOT_TOKEN como en tu webhook

// Función auxiliar para enviar un único mensaje, que será usada por sendMessage
async function sendSingleMessage(chatid, text, parseMode, silent, replyMarkup, replyToMessageId) {
    const url = `${TELEGRAM_API_URL}/sendMessage`;
    const body = {
        chat_id: chatid,
        text: text,
    };

    if (parseMode) body.parse_mode = parseMode;
    if (silent) body.disable_notification = true;
    if (replyMarkup) body.reply_markup = replyMarkup;
    if (replyToMessageId) body.reply_to_message_id = replyToMessageId;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok){
            console.error("Failed to send message to telegram user. Status:", response.status, "Body:", await response.text());
        }
        return response;
    } catch (err) {
        console.error("Error occured while sending message to telegram user", err);
        return null;
    }
}

export async function sendMessage(chatid, text, parseMode = "HTML", silent = false, replyMarkup = null, replyToMessageId = null) {
    // Límite de Telegram es 4096, usamos un valor seguro
    const SAFE_MAX_LENGTH = 4000;

    if (text.length <= SAFE_MAX_LENGTH) {
        return await sendSingleMessage(chatid, text, parseMode, silent, replyMarkup, replyToMessageId);
    }

    console.log(`Mensaje largo detectado (longitud: ${text.length}). Dividiendo en partes...`);
    
    const chunks = [];
    let currentChunk = "";
    const lines = text.split('\n');

    for (const line of lines) {
        // Si una sola línea es demasiado larga, debe ser dividida
        if (line.length > SAFE_MAX_LENGTH) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            const lineChunks = line.match(new RegExp(`.{1,${SAFE_MAX_LENGTH}}`, 'g')) || [];
            chunks.push(...lineChunks);
            continue;
        }

        // Si añadir la siguiente línea excede el límite, se guarda el chunk actual
        if (currentChunk.length + line.length + 1 > SAFE_MAX_LENGTH) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    let firstResponse = null;
    // Enviar cada chunk con una pequeña pausa
    for (let i = 0; i < chunks.length; i++) {
        const currentReplyId = i === 0 ? replyToMessageId : null;
        const response = await sendSingleMessage(chatid, chunks[i], parseMode, silent, replyMarkup, currentReplyId);
        if (i === 0) {
            firstResponse = response;
        }
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    return firstResponse;
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
        // Devolver la respuesta parseada para poder acceder a result.message_id, etc.
        return await response.json();
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

export async function editMessageText(chatid, messageId, text, parseMode = "HTML", replyMarkup = null) {
    const url = `${TELEGRAM_API_URL}/editMessageText`;
    const body = {
        chat_id: chatid,
        message_id: messageId,
        text: text,
    };
    if (parseMode) {
        body.parse_mode = parseMode;
    }
    if (replyMarkup) { // Nuevo: para editar/quitar inline_keyboard
        body.reply_markup = replyMarkup;
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
        // Devolver la respuesta completa o parseada si es necesario
        return response; // o await response.json() si necesitas el mensaje editado
    } catch (err) {
        console.error("Error editing message", err);
        return null; // o false si prefieres booleano
    }
}

export async function forwardMessage(targetChatId, fromChatId, messageId) {
    const url = `${TELEGRAM_API_URL}/forwardMessage`;
    const body = {
        chat_id: targetChatId,
        from_chat_id: fromChatId,
        message_id: messageId,
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
        document: fileId,
    };
    if (caption) {
        body.caption = caption;
    }
    if (parseMode && caption) {
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

export async function sendSticker(chatid, fileId) {
    const url = `${TELEGRAM_API_URL}/sendSticker`;
    const bodyPayload = {
        chat_id: chatid,
        sticker: fileId,
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        if (!response.ok) {
            console.error(`Failed to send sticker. ChatID: ${chatid}, FileID: ${fileId}. Status: ${response.status}, Body: ${await response.text()}`);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error("Error in sendSticker fetch:", err);
        return null;
    }
}

// Nueva función para answerCallbackQuery
export async function answerCallbackQuery(callbackQueryId, options = {}) {
  const url = `${TELEGRAM_API_URL}/answerCallbackQuery`;
  const body = {
    callback_query_id: callbackQueryId,
    ...options, // text, show_alert, url, cache_time
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // No es crítico si esto falla, así que solo logueamos
      console.error('Error en answerCallbackQuery:', response.status, await response.text());
    }
    // No necesitamos parsear la respuesta de answerCallbackQuery generalmente,
    // solo saber si se envió o no. response.ok es suficiente.
    return response.ok;
  } catch (error) {
    console.error('Error de red en answerCallbackQuery:', error);
    return false; // Falló la comunicación
  }
}