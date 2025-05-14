// utils/telegram.js
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
import { escapeMarkdownV2 } from './moeHandler';


export async function sendMessage(chatid, text, parseMode = null) { // Añadido parseMode
    const url = `${TELEGRAM_API_URL}/sendMessage`;
    const body = {
        chat_id: chatid,
        text: escapeMarkdownV2(text),
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
export async function editMessageText(chatid, messageId, text, parseMode = null) {
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