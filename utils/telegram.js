// utils/telegram.js
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

export async function getFilePath(fileId) {
  const url = `${TELEGRAM_API_URL}/getFile`;
  const body = { file_id: fileId };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        "Failed to get file path. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
      return null;
    }
    const data = await response.json();
    return data.result.file_path;
  } catch (err) {
    console.error("Error occurred while getting file path", err);
    return null;
  }
}

export async function sendChatAction(chatId, action = "typing") {
  const url = `${TELEGRAM_API_URL}/sendChatAction`;
  const body = {
    chat_id: chatId,
    action: action,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        "Failed to send chat action. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
    }
    return response;
  } catch (err) {
    console.error("Error occurred while sending chat action", err);
    return null;
  }
} // Cambiado a TELEGRAM_BOT_TOKEN como en tu webhook

// Función auxiliar para enviar un único mensaje, que será usada por sendMessage
async function sendSingleMessage(
  chatid,
  text,
  parseMode,
  silent,
  replyMarkup,
  replyToMessageId,
) {
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
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        "Failed to send message to telegram user. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
    }
    return response;
  } catch (err) {
    console.error("Error occured while sending message to telegram user", err);
    return null;
  }
}

export async function sendMessage(
  chatid,
  text,
  parseMode = "HTML",
  silent = false,
  replyMarkup = null,
  replyToMessageId = null,
) {
  // Límite de Telegram es 4096, usamos un valor seguro
  const SAFE_MAX_LENGTH = 4000;

  if (text.length <= SAFE_MAX_LENGTH) {
    return await sendSingleMessage(
      chatid,
      text,
      parseMode,
      silent,
      replyMarkup,
      replyToMessageId,
    );
  }

  console.log(
    `Mensaje largo detectado (longitud: ${text.length}). Dividiendo en partes...`,
  );

  const chunks = [];
  let currentChunk = "";
  const lines = text.split("\n");

  for (const line of lines) {
    // Si una sola línea es demasiado larga, debe ser dividida
    if (line.length > SAFE_MAX_LENGTH) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      const lineChunks =
        line.match(new RegExp(`.{1,${SAFE_MAX_LENGTH}}`, "g")) || [];
      chunks.push(...lineChunks);
      continue;
    }

    // Si añadir la siguiente línea excede el límite, se guarda el chunk actual
    if (currentChunk.length + line.length + 1 > SAFE_MAX_LENGTH) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk.length > 0 ? "\n" : "") + line;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  let firstResponse = null;
  // Enviar cada chunk con una pequeña pausa
  for (let i = 0; i < chunks.length; i++) {
    const currentReplyId = i === 0 ? replyToMessageId : null;
    const response = await sendSingleMessage(
      chatid,
      chunks[i],
      parseMode,
      silent,
      replyMarkup,
      currentReplyId,
    );
    if (i === 0) {
      firstResponse = response;
    }
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return firstResponse;
}

export async function sendDice(chatid, emoji = "🎲") {
  const url = `${TELEGRAM_API_URL}/sendDice`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatid, emoji: emoji }),
    });
    if (!response.ok) {
      console.error(
        "Failed to send dice. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
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
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatid, message_id: messageId }),
    });
    if (!response.ok) {
      console.error(
        "Failed to delete message. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
    }
    return response.ok;
  } catch (err) {
    console.error("Error deleting message", err);
    return false;
  }
}

export async function editMessageText(
  chatid,
  messageId,
  text,
  parseMode = "HTML",
  replyMarkup = null,
) {
  const url = `${TELEGRAM_API_URL}/editMessageText`;
  const body = {
    chat_id: chatid,
    message_id: messageId,
    text: text,
  };
  if (parseMode) {
    body.parse_mode = parseMode;
  }
  if (replyMarkup) {
    // Nuevo: para editar/quitar inline_keyboard
    body.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        "Failed to edit message. Status:",
        response.status,
        "Body:",
        await response.text(),
      );
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
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        `Failed to forward message. TargetChat: ${targetChatId}, FromChat: ${fromChatId}, MsgID: ${messageId}. Status: ${response.status}, Body: ${await response.text()}`,
      );
    }
    return response;
  } catch (err) {
    console.error("Error forwarding message:", err);
    return null;
  }
}

export async function sendDocumentByFileId(
  chatid,
  fileId,
  caption = null,
  parseMode = "HTML",
) {
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
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        `Failed to send document by file_id. ChatID: ${chatid}, FileID: ${fileId}. Status: ${response.status}, Body: ${await response.text()}`,
      );
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
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
    if (!response.ok) {
      console.error(
        `Failed to send sticker. ChatID: ${chatid}, FileID: ${fileId}. Status: ${response.status}, Body: ${await response.text()}`,
      );
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // No es crítico si esto falla, así que solo logueamos
      console.error(
        "Error en answerCallbackQuery:",
        response.status,
        await response.text(),
      );
    }
    // No necesitamos parsear la respuesta de answerCallbackQuery generalmente,
    // solo saber si se envió o no. response.ok es suficiente.
    return response.ok;
  } catch (error) {
    console.error("Error de red en answerCallbackQuery:", error);
    return false; // Falló la comunicación
  }
}

// Nueva función para obtener miembros del chat (administradores)
export async function getChatAdministrators(chatId) {
  const url = `${TELEGRAM_API_URL}/getChatAdministrators`;
  const body = {
    chat_id: chatId,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = JSON.parse(errorText);

      // Manejar casos específicos de error
      if (
        errorData.description &&
        errorData.description.includes("private chat")
      ) {
        console.warn(
          `Chat ${chatId} es un chat privado, no se pueden obtener administradores`,
        );
        return [];
      } else if (
        errorData.description &&
        errorData.description.includes("chat not found")
      ) {
        console.error(`Chat ${chatId} no encontrado o bot no tiene acceso`);
        return [];
      } else if (
        errorData.description &&
        errorData.description.includes("not enough rights")
      ) {
        console.error(`Bot no tiene permisos suficientes en el chat ${chatId}`);
        return [];
      }

      console.error(
        `Error obteniendo administradores del chat ${chatId}:`,
        response.status,
        errorData.description || errorText,
      );
      return [];
    }

    const data = await response.json();
    const administrators = data.result || [];
    console.log(
      `Encontrados ${administrators.length} administradores en el chat ${chatId}`,
    );
    return administrators;
  } catch (error) {
    console.error(
      `Error de red en getChatAdministrators para chat ${chatId}:`,
      error,
    );
    return [];
  }
}

// Lista de miembros adicionales registrados para recibir tareas
// Estos son usuarios que no son administradores pero pueden recibir tareas
// Para obtener el ID de un usuario, puedes usar el comando /info en el chat
// IDs de usuarios registrados - sus nombres reales se obtendrán automáticamente
const REGISTERED_USER_IDS = [
  6338282245, // @Luke_1606
  5756622788, // @Eldenmaster
  1149432007, // @MadaraXD
  6134558583, // @Khaylene
  1068057978, // @patricialdv
  991216025, // @NakataYuu
];

// Cache para almacenar la información de usuarios obtenida
const MEMBERS_CACHE = new Map();

// Función para obtener información real de un usuario registrado
async function getRegisteredMemberInfo(chatId, userId) {
  // Verificar cache primero
  const cacheKey = `${chatId}_${userId}`;
  if (MEMBERS_CACHE.has(cacheKey)) {
    return MEMBERS_CACHE.get(cacheKey);
  }

  try {
    const memberInfo = await getChatMember(chatId, userId);
    if (memberInfo && memberInfo.user && !memberInfo.user.is_bot) {
      const member = {
        id: memberInfo.user.id,
        first_name: memberInfo.user.first_name,
        username: memberInfo.user.username || null,
        status: memberInfo.status,
        is_admin: false,
      };

      // Guardar en cache
      MEMBERS_CACHE.set(cacheKey, member);
      return member;
    }
  } catch (error) {
    console.warn(
      `No se pudo obtener info del usuario ${userId} en chat ${chatId}:`,
      error.message,
    );
  }

  return null;
}

// Función para agregar un miembro registrado manualmente (para desarrollo/testing)
export function addRegisteredMember(userId) {
  if (!REGISTERED_USER_IDS.includes(userId)) {
    REGISTERED_USER_IDS.push(userId);
    console.log(`Usuario registrado manualmente: ${userId}`);
  }
  return userId;
}

// Función para obtener la lista actual de IDs registrados
export function getRegisteredMemberIds() {
  return [...REGISTERED_USER_IDS];
}

// Nueva función para obtener todos los miembros disponibles (administradores + registrados)
export async function getAllAvailableMembers(chatId, excludeUserId = null) {
  try {
    // Obtener administradores del chat
    const administrators = await getChatAdministrators(chatId);

    // Crear lista de todos los miembros disponibles
    const allMembers = [];

    // Agregar administradores
    administrators.forEach((admin) => {
      if (admin.user && !admin.user.is_bot) {
        allMembers.push({
          id: admin.user.id,
          first_name: admin.user.first_name,
          username: admin.user.username || null,
          status: admin.status,
          is_admin: true,
        });
      }
    });

    // Agregar miembros registrados obteniendo su información real de Telegram
    for (const userId of REGISTERED_USER_IDS) {
      const alreadyExists = allMembers.find((m) => m.id === userId);
      if (!alreadyExists) {
        const memberInfo = await getRegisteredMemberInfo(chatId, userId);
        if (memberInfo) {
          allMembers.push(memberInfo);
        }
      }
    }

    // Filtrar usuario excluido (como Claudia) si se especifica
    const filteredMembers = excludeUserId
      ? allMembers.filter((member) => member.id !== excludeUserId)
      : allMembers;

    // Filtrar solo usuarios con nombre válido
    const validMembers = filteredMembers.filter(
      (member) => member.first_name && member.first_name.trim() !== "",
    );

    console.log(
      `Miembros disponibles encontrados en chat ${chatId}: ${validMembers.length} (${validMembers.map((m) => m.first_name).join(", ")})`,
    );

    return validMembers;
  } catch (error) {
    console.error(
      `Error obteniendo miembros disponibles del chat ${chatId}:`,
      error,
    );
    return [];
  }
}

// Función auxiliar para verificar si un usuario es miembro disponible
export async function isUserAvailableForTasks(chatId, userId) {
  try {
    const availableMembers = await getAllAvailableMembers(chatId);
    return availableMembers.some((member) => member.id === userId);
  } catch (error) {
    console.error(
      `Error verificando disponibilidad del usuario ${userId}:`,
      error,
    );
    return false;
  }
}

// Función para obtener estadísticas de miembros
export async function getMemberStats(chatId) {
  try {
    const allMembers = await getAllAvailableMembers(chatId);
    const admins = allMembers.filter((m) => m.is_admin);
    const regularMembers = allMembers.filter((m) => !m.is_admin);

    return {
      total: allMembers.length,
      admins: admins.length,
      regularMembers: regularMembers.length,
      adminsList: admins.map((a) => a.first_name),
      membersList: regularMembers.map((m) => m.first_name),
    };
  } catch (error) {
    console.error(`Error obteniendo estadísticas de miembros:`, error);
    return null;
  }
}

// Nueva función para obtener información de un miembro específico
export async function getChatMember(chatId, userId) {
  const url = `${TELEGRAM_API_URL}/getChatMember`;
  const body = {
    chat_id: chatId,
    user_id: userId,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        "Error obteniendo información del miembro:",
        response.status,
        await response.text(),
      );
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error("Error de red en getChatMember:", error);
    return null;
  }
}
