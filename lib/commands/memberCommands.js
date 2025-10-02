// lib/commands/memberCommands.js
import * as MemberService from "@/lib/services/memberService";
import { escapeHTML, bold, code } from "@/lib/utils/htmlEscaper";
import { sendMessage, getChatMember } from "@/utils/telegram";
import { getRandomKaomoji } from "@/lib/services/moeHandler";

export async function handleAddMember(context, params) {
  const { chatId, userId, message } = context;

  try {
    let targetUserId = null;
    let firstName = null;
    let username = null;

    // Caso 1: Reply a un mensaje
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id;
      firstName = message.reply_to_message.from.first_name;
      username = message.reply_to_message.from.username;
    }
    // Caso 2: @username proporcionado en los argumentos
    else if (params.args) {
      const argsText = params.args.trim();
      const usernameMatch = argsText.match(/@?(\w+)/);

      if (usernameMatch) {
        const extractedUsername = usernameMatch[1];

        try {
          // Intentar obtener información del usuario desde el chat
          const memberInfo = await getChatMember(
            chatId,
            `@${extractedUsername}`,
          );

          if (memberInfo && memberInfo.user && !memberInfo.user.is_bot) {
            targetUserId = memberInfo.user.id;
            firstName = memberInfo.user.first_name;
            username = memberInfo.user.username;
          } else if (memberInfo && memberInfo.user && memberInfo.user.is_bot) {
            await sendMessage(
              chatId,
              `No puedo agregar bots al equipo! ${getRandomKaomoji()}`,
              "HTML",
            );
            return { success: false, error: "Cannot add bots" };
          } else {
            await sendMessage(
              chatId,
              `No pude encontrar al usuario @${extractedUsername} en este grupo. ${getRandomKaomoji()}\n\n` +
                `Asegúrate de que la persona esté en el grupo y haya enviado al menos un mensaje.`,
              "HTML",
            );
            return { success: false, error: "User not found" };
          }
        } catch (error) {
          console.error("Error getting chat member:", error);
          await sendMessage(
            chatId,
            `No pude encontrar al usuario @${extractedUsername}. ${getRandomKaomoji()}\n\n` +
              `Intenta responder a un mensaje de esa persona con ${code("/addMember")} en su lugar.`,
            "HTML",
          );
          return { success: false, error: "User not found in chat" };
        }
      }
    }

    // Si no se pudo obtener el usuario de ninguna forma
    if (!targetUserId) {
      await sendMessage(
        chatId,
        `Para agregar un miembro necesito que: ${getRandomKaomoji()}\n\n` +
          `1️⃣ Respondas al mensaje de esa persona con ${code("/addMember")}, O\n` +
          `2️⃣ Uses ${code("/addMember @username")} si conoces su username de Telegram\n\n` +
          `⚠️ No puedo agregar miembros solo por su nombre (ej: "Manolo") porque necesito su ID de Telegram para identificarlos correctamente.`,
        "HTML",
      );
      return { success: false };
    }

    const memberData = {
      userId: targetUserId,
      username,
      firstName,
      role: "Team Member",
    };

    const addedMember = await MemberService.addMember(
      chatId,
      memberData,
      userId,
    );

    await sendMessage(
      chatId,
      `✅ Member added successfully! ${getRandomKaomoji()}\n\n${escapeHTML(firstName)} is now part of the team!`,
      "HTML",
    );

    return { success: true, member: addedMember };
  } catch (error) {
    console.error("Error in handleAddMember:", error);

    let errorMessage = `Oops! No pude agregar al miembro. ${getRandomKaomoji()}\n\n`;

    if (error.message.includes("already exists")) {
      errorMessage += `Este usuario ya es miembro del equipo. Usa ${code("/listMembers")} para ver el equipo.`;
    } else {
      errorMessage += `Error: ${escapeHTML(error.message)}`;
    }

    await sendMessage(chatId, errorMessage, "HTML");
    return { success: false, error: error.message };
  }
}

export async function handleRemoveMember(context, params) {
  const { chatId, message } = context;

  try {
    let targetUserId = null;

    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id;
    } else {
      await sendMessage(chatId, "Please reply to a user's message!", "HTML");
      return { success: false };
    }

    const removed = await MemberService.removeMember(chatId, targetUserId);

    if (removed) {
      await sendMessage(
        chatId,
        `✅ Member removed! ${getRandomKaomoji()}`,
        "HTML",
      );
      return { success: true };
    }

    return { success: false };
  } catch (error) {
    console.error("Error in handleRemoveMember:", error);
    return { success: false, error: error.message };
  }
}

export async function handleListMembers(context, params) {
  const { chatId } = context;

  try {
    const members = await MemberService.getAllMembers(chatId);

    if (members.length === 0) {
      await sendMessage(
        chatId,
        `📋 ${bold("Team Members")}\n\nThe team is empty! Add members with /addMember`,
        "HTML",
      );
      return { success: true, members: [] };
    }

    let message = `📋 ${bold("Team Members")} (${members.length})\n\n`;

    members.forEach((member, index) => {
      const displayName =
        member.custom_name ||
        member.first_name ||
        member.username ||
        `User ${member.user_id}`;
      message += `${index + 1}. ${escapeHTML(displayName)}`;
      if (member.role) {
        message += ` - ${escapeHTML(member.role)}`;
      }
      message += "\n";
    });

    await sendMessage(chatId, message, "HTML");
    return { success: true, members };
  } catch (error) {
    console.error("Error in handleListMembers:", error);
    return { success: false, error: error.message };
  }
}

export async function handleMemberInfo(context, params) {
  return { success: false, error: "Not implemented yet" };
}

export async function handleUpdateMember(context, params) {
  return { success: false, error: "Not implemented yet" };
}

export async function handleTeamStats(context, params) {
  const { chatId } = context;

  try {
    const stats = await MemberService.getTeamStats(chatId);

    let message = `📊 ${bold("Team Statistics")}\n\n`;
    message += `Total Members: ${stats.total_members}\n`;

    await sendMessage(chatId, message, "HTML");
    return { success: true, stats };
  } catch (error) {
    console.error("Error in handleTeamStats:", error);
    return { success: false, error: error.message };
  }
}
