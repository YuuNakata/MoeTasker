// lib/commands/registerCommands.js
import { registerCommand } from "@/lib/services/commandRegistry";
import {
  handleAddMember,
  handleRemoveMember,
  handleListMembers,
  handleMemberInfo,
  handleUpdateMember,
  handleTeamStats,
} from "./memberCommands";
import {
  handleAssign,
  handleTasks,
  handleComplete,
  handleClearTasks,
  handleMyTasks,
  handleTaskStats,
} from "./taskCommands";

/**
 * Registers all bot commands in the Command Registry
 * This makes them available for both direct invocation and AI-powered execution
 */
export function registerAllCommands() {
  console.log("🚀 Registering all bot commands...");

  // ============================================
  // MEMBER MANAGEMENT COMMANDS
  // ============================================

  registerCommand({
    name: "addMember",
    description: "Add a new member to the team. Reply to their message or mention them with @username.",
    parameters: [
      {
        name: "args",
        type: "string",
        required: false,
        description: "Optional: @username, custom name, or role: RoleName",
      },
    ],
    handler: handleAddMember,
    aliases: ["addmember", "add_member"],
    category: "members",
    requiresAdmin: false,
    example: "/addMember (reply to user's message) or /addMember @username or /addMember CustomName",
  });

  registerCommand({
    name: "removeMember",
    description: "Remove a member from the team. Reply to their message or mention them.",
    parameters: [
      {
        name: "args",
        type: "string",
        required: false,
        description: "Optional: @username",
      },
    ],
    handler: handleRemoveMember,
    aliases: ["removemember", "remove_member", "deleteMember"],
    category: "members",
    requiresAdmin: false,
    example: "/removeMember (reply to message) or /removeMember @username",
  });

  registerCommand({
    name: "listMembers",
    description: "List all active team members with their roles and info.",
    parameters: [],
    handler: handleListMembers,
    aliases: ["listmembers", "list_members", "members", "team", "miembros"],
    category: "members",
    requiresAdmin: false,
    example: "/listMembers",
  });

  registerCommand({
    name: "memberInfo",
    description: "Show detailed information about a specific team member.",
    parameters: [
      {
        name: "args",
        type: "string",
        required: false,
        description: "Optional: @username or reply to their message",
      },
    ],
    handler: handleMemberInfo,
    aliases: ["memberinfo", "member_info", "whoIs"],
    category: "members",
    requiresAdmin: false,
    example: "/memberInfo @username or reply with /memberInfo",
  });

  registerCommand({
    name: "updateMember",
    description: "Update a member's information (role, bio, display name).",
    parameters: [
      {
        name: "args",
        type: "string",
        required: true,
        description: "Updates in format: role: Developer, bio: Description, name: DisplayName",
      },
    ],
    handler: handleUpdateMember,
    aliases: ["updatemember", "update_member", "editMember"],
    category: "members",
    requiresAdmin: false,
    example: "/updateMember role: Developer (reply to message) or /updateMember @username role: Designer",
  });

  registerCommand({
    name: "teamStats",
    description: "Show statistics about the team (total members, roles distribution, etc.).",
    parameters: [],
    handler: handleTeamStats,
    aliases: ["teamstats", "team_stats", "stats"],
    category: "members",
    requiresAdmin: false,
    example: "/teamStats",
  });

  // ============================================
  // TASK MANAGEMENT COMMANDS
  // ============================================

  registerCommand({
    name: "assign",
    description: "Assign tasks to team members. Tasks will be distributed evenly and randomly.",
    parameters: [
      {
        name: "tasks",
        type: "string",
        required: true,
        description: "Comma-separated list of tasks",
      },
    ],
    handler: handleAssign,
    aliases: ["assignTasks", "assign_tasks", "asignar"],
    category: "tasks",
    requiresAdmin: false,
    example: "/assign Task 1, Task 2, Task 3",
  });

  registerCommand({
    name: "tasks",
    description: "Show all pending tasks and who they're assigned to.",
    parameters: [],
    handler: handleTasks,
    aliases: ["listTasks", "list_tasks", "tareas", "pendingTasks"],
    category: "tasks",
    requiresAdmin: false,
    example: "/tasks",
  });

  registerCommand({
    name: "complete",
    description: "Mark a task as completed using its ID.",
    parameters: [
      {
        name: "taskId",
        type: "string",
        required: true,
        description: "The task ID to complete",
      },
    ],
    handler: handleComplete,
    aliases: ["completeTask", "complete_task", "done", "completar"],
    category: "tasks",
    requiresAdmin: false,
    example: "/complete TASK_ID",
  });

  registerCommand({
    name: "clearTasks",
    description: "Clear all pending tasks. Use with caution!",
    parameters: [],
    handler: handleClearTasks,
    aliases: ["clear_tasks", "clearAllTasks", "clear"],
    category: "tasks",
    requiresAdmin: true,
    example: "/clearTasks",
  });

  registerCommand({
    name: "myTasks",
    description: "Show your assigned tasks.",
    parameters: [],
    handler: handleMyTasks,
    aliases: ["mytasks", "my_tasks", "misTareas"],
    category: "tasks",
    requiresAdmin: false,
    example: "/myTasks",
  });

  registerCommand({
    name: "taskStats",
    description: "Show task statistics (total, pending, completed, top contributor).",
    parameters: [],
    handler: handleTaskStats,
    aliases: ["taskstats", "task_stats"],
    category: "tasks",
    requiresAdmin: false,
    example: "/taskStats",
  });

  // ============================================
  // ORACLE / DECISIONS COMMANDS (PLACEHOLDERS)
  // ============================================

  registerCommand({
    name: "oracle",
    description: "Ask the oracle a question or get a random decision memory.",
    parameters: [
      {
        name: "question",
        type: "string",
        required: false,
        description: "Optional question to ask",
      },
    ],
    handler: async (context, params) => {
      // Placeholder - will be implemented
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      await sendMessage(
        chatId,
        "🔮 Oracle command coming soon! Stay tuned~ (◕‿◕)",
        "HTML"
      );
      return { success: false, error: "Not yet implemented" };
    },
    aliases: ["oraculo", "ask"],
    category: "oracle",
    requiresAdmin: false,
    example: "/oracle Should we use React or Vue?",
  });

  registerCommand({
    name: "saveDecision",
    description: "Save an important team decision for future reference.",
    parameters: [
      {
        name: "decision",
        type: "string",
        required: true,
        description: "The decision text to save",
      },
    ],
    handler: async (context, params) => {
      // Placeholder - will be implemented
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      await sendMessage(
        chatId,
        "📝 Save decision command coming soon! (｡◕‿◕｡)",
        "HTML"
      );
      return { success: false, error: "Not yet implemented" };
    },
    aliases: ["save_decision", "decision", "guardar_decision"],
    category: "oracle",
    requiresAdmin: false,
    example: "/saveDecision We will use PostgreSQL for the database",
  });

  // ============================================
  // GENERAL / UTILITY COMMANDS (PLACEHOLDERS)
  // ============================================

  registerCommand({
    name: "help",
    description: "Show available commands and how to use the bot.",
    parameters: [
      {
        name: "category",
        type: "string",
        required: false,
        description: "Optional: show commands for a specific category",
      },
    ],
    handler: async (context, params) => {
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      const { generateHelpMessage } = await import("@/lib/services/commandRegistry");

      const category = params.category || params.args;
      const helpMessage = generateHelpMessage(category);

      await sendMessage(chatId, helpMessage, "HTML");
      return { success: true };
    },
    aliases: ["start", "ayuda", "commands"],
    category: "general",
    requiresAdmin: false,
    example: "/help or /help members",
  });

  registerCommand({
    name: "config",
    description: "Show bot configuration and system status.",
    parameters: [],
    handler: async (context, params) => {
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      const { bold, code } = await import("@/lib/utils/htmlEscaper");
      const { getRandomKaomoji } = await import("@/lib/services/moeHandler");

      const configMessage = `⚙️ ${bold("Bot Configuration")} ${getRandomKaomoji()}\n\n` +
        `Version: 2.0.0\n` +
        `Model: llama-4-scout-17b-16e-instruct\n` +
        `Multi-Team: ✅ Enabled\n` +
        `AI Commands: ✅ Enabled\n\n` +
        `Use ${code("/help")} to see all commands!`;

      await sendMessage(chatId, configMessage, "HTML");
      return { success: true };
    },
    aliases: ["status", "info"],
    category: "general",
    requiresAdmin: false,
    example: "/config",
  });

  registerCommand({
    name: "phrase",
    description: "Get a random fun phrase or kaomoji to brighten your day!",
    parameters: [],
    handler: async (context, params) => {
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      const { getRandomFunPhrase } = await import("@/lib/services/moeHandler");

      const { phrase, kaomoji } = getRandomFunPhrase();
      await sendMessage(chatId, `${phrase} ${kaomoji}`, "HTML");
      return { success: true };
    },
    aliases: ["relax", "frase", "kaomoji"],
    category: "fun",
    requiresAdmin: false,
    example: "/phrase",
  });

  // ============================================
  // GITHUB STATS COMMANDS (PLACEHOLDERS)
  // ============================================

  registerCommand({
    name: "repoStats",
    description: "Show GitHub repository statistics (commits, contributions, etc.).",
    parameters: [
      {
        name: "period",
        type: "string",
        required: false,
        description: "Time period: week, month, or total (default: week)",
      },
      {
        name: "branch",
        type: "string",
        required: false,
        description: "Branch name (default: main)",
      },
    ],
    handler: async (context, params) => {
      // Placeholder - will be implemented
      const { chatId } = context;
      const { sendMessage } = await import("@/utils/telegram");
      await sendMessage(
        chatId,
        "📊 GitHub stats command coming soon! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
        "HTML"
      );
      return { success: false, error: "Not yet implemented" };
    },
    aliases: ["repo_stats", "githubStats", "github"],
    category: "github",
    requiresAdmin: false,
    example: "/repoStats week main",
  });

  console.log("✅ All commands registered successfully!");
}

/**
 * Initialize command system - call this when the bot starts
 */
export async function initializeCommandSystem() {
  try {
    console.log("🎯 Initializing command system...");

    // Register all commands
    registerAllCommands();

    console.log("✅ Command system initialized successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error initializing command system:", error);
    throw error;
  }
}
