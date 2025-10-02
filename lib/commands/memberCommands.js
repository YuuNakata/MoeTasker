// lib/commands/memberCommands.js
import * as MemberService from "@/lib/services/memberService";
import { escapeHTML, bold, code } from "@/lib/utils/htmlEscaper";
import { sendMessage } from "@/utils/telegram";
import { getRandomKaomoji } from "@/lib/services/moeHandler";

export async function handleAddMember(context, params) {
  const { chatId, userId, message } = context;

  try {
    let targetUserId = null;
    let firstName = null;
    let username = null;

    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id;
      firstName = message.reply_to_message.from.first_name;
      username = message.reply_to_message.from.username;
    } else {
      await sendMessage(
        chatId,
        `Please reply to a user's message with /addMember! ${getRandomKaomoji()}`,
        "HTML"
      );
      return { success: false };
    }

    const memberData = {
      userId: targetUserId,
      username,
      firstName,
      role: "Team Member",
    };

    const addedMember = await MemberService.addMember(chatId, memberData, userId);

    await sendMessage(
      chatId,
      `✅ Member added successfully! ${getRandomKaomoji()}\n\n${escapeHTML(firstName)} is now part of the team!`,
      "HTML"
    );

    return { success: true, member: addedMember };
  } catch (error) {
    console.error("Error in handleAddMember:", error);
    await sendMessage(chatId, `Error: ${escapeHTML(error.message)}`, "HTML");
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
      await sendMessage(chatId, `✅ Member removed! ${getRandomKaomoji()}`, "HTML");
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
        "HTML"
      );
      return { success: true, members: [] };
    }

    let message = `📋 ${bold("Team Members")} (${members.length})\n\n`;

    members.forEach((member, index) => {
      const displayName = member.custom_name || member.first_name || member.username || `User ${member.user_id}`;
      message += `${index + 1}. ${escapeHTML(displayName)}`;
      if (member.role) {
        message += ` - ${escapeHTML(member.role)}`;
      }
      message += '\n';
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
