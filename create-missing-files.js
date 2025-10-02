// create-missing-files.js
// Script para crear todos los archivos faltantes del sistema v2.0
// Ejecutar con: node create-missing-files.js

const fs = require('fs');
const path = require('path');

console.log('🚀 Creating missing files for MoeTasker v2.0...\n');

// Helper function to create file with content
function createFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }

  // Write file
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Created: ${filePath}`);
}

// 1. commandRegistry.js
const commandRegistryContent = `// lib/services/commandRegistry.js

/**
 * Central Command Registry System
 * This system allows the AI to be aware of all available commands,
 * their parameters, descriptions, and can execute them programmatically.
 */

/**
 * Command registry - stores all available bot commands
 */
const commands = new Map();

/**
 * Registers a new command in the system
 */
export function registerCommand(commandConfig) {
  const {
    name,
    description,
    parameters = [],
    handler,
    aliases = [],
    category = 'general',
    requiresAdmin = false,
    example = '',
  } = commandConfig;

  if (!name || !handler) {
    throw new Error('Command name and handler are required');
  }

  const command = {
    name,
    description,
    parameters,
    handler,
    aliases,
    category,
    requiresAdmin,
    example,
    registeredAt: new Date(),
  };

  commands.set(name, command);

  // Register aliases
  aliases.forEach(alias => {
    commands.set(alias, { ...command, isAlias: true, aliasOf: name });
  });

  console.log(\`✅ Command registered: /\${name}\`);
}

/**
 * Gets a command by name or alias
 */
export function getCommand(commandName) {
  return commands.get(commandName) || null;
}

/**
 * Gets all registered commands
 */
export function getAllCommands() {
  const allCommands = [];
  commands.forEach((command, name) => {
    if (!command.isAlias) {
      allCommands.push({ name, ...command });
    }
  });
  return allCommands;
}

/**
 * Executes a command programmatically
 */
export async function executeCommand(commandName, context, params = {}) {
  const command = getCommand(commandName);

  if (!command) {
    throw new Error(\`Command not found: \${commandName}\`);
  }

  const actualCommand = command.isAlias
    ? getCommand(command.aliasOf)
    : command;

  try {
    console.log(\`🤖 AI executing command: /\${commandName}\`, params);

    const missingParams = actualCommand.parameters
      .filter(p => p.required && !params[p.name])
      .map(p => p.name);

    if (missingParams.length > 0) {
      return {
        success: false,
        error: \`Missing required parameters: \${missingParams.join(', ')}\`,
        command: commandName,
      };
    }

    const result = await actualCommand.handler(context, params);

    return {
      success: true,
      command: commandName,
      result,
    };
  } catch (error) {
    console.error(\`❌ Error executing command /\${commandName}:\`, error);
    return {
      success: false,
      error: error.message,
      command: commandName,
    };
  }
}

/**
 * Generates a formatted list of all commands for the AI
 */
export function getCommandsForAIPrompt() {
  const commandsList = getAllCommands();

  if (commandsList.length === 0) {
    return "No commands registered yet.";
  }

  const categories = {};
  commandsList.forEach(cmd => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });

  let prompt = "🤖 **AVAILABLE COMMANDS** - You can execute these commands by detecting user intent:\\n\\n";

  Object.keys(categories).sort().forEach(category => {
    prompt += \`**\${category.toUpperCase()}:**\\n\`;

    categories[category].forEach(cmd => {
      prompt += \`• /\${cmd.name}\`;

      if (cmd.parameters.length > 0) {
        const params = cmd.parameters.map(p => {
          const paramName = p.required ? \`<\${p.name}>\` : \`[\${p.name}]\`;
          return paramName;
        }).join(' ');
        prompt += \` \${params}\`;
      }

      prompt += \`\\n  Description: \${cmd.description}\`;

      if (cmd.parameters.length > 0) {
        prompt += \`\\n  Parameters:\`;
        cmd.parameters.forEach(p => {
          prompt += \`\\n    - \${p.name} (\${p.type})\${p.required ? ' [REQUIRED]' : ' [OPTIONAL]'}: \${p.description}\`;
        });
      }

      if (cmd.example) {
        prompt += \`\\n  Example: \${cmd.example}\`;
      }

      if (cmd.aliases.length > 0) {
        prompt += \`\\n  Aliases: \${cmd.aliases.map(a => \`/\${a}\`).join(', ')}\`;
      }

      prompt += '\\n\\n';
    });
  });

  prompt += \`\\n**🎯 IMPORTANT FOR AI:**
- When a user asks you to do something that matches a command, YOU CAN EXECUTE IT DIRECTLY
- Don't just tell the user the command syntax - EXECUTE IT FOR THEM
- Extract parameters from the user's message context
- Example: User says "assign these tasks: fix bug, write docs" → You execute /assign with those tasks
- Example: User says "add John to the team" → You execute /addMember for John
- Always confirm what you're doing: "I'll add those tasks for you!" then execute
- If you need more info for required parameters, ASK before executing\\n\`;

  return prompt;
}

/**
 * Parses a text command and extracts command name and arguments
 */
export function parseCommand(text) {
  if (!text || !text.startsWith('/')) {
    return null;
  }

  const parts = text.trim().split(/\\s+/);
  const commandPart = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1).join(' ');

  const command = getCommand(commandPart);

  if (!command) {
    return null;
  }

  return {
    name: commandPart,
    command,
    rawArgs: args,
    fullText: text,
  };
}

/**
 * Checks if a command exists
 */
export function commandExists(commandName) {
  return commands.has(commandName);
}

/**
 * Generates a help message for users
 */
export function generateHelpMessage(category = null) {
  let commandsList = getAllCommands();

  if (category) {
    commandsList = commandsList.filter(cmd => cmd.category === category);
  }

  if (commandsList.length === 0) {
    return "No commands available.";
  }

  const categories = {};
  commandsList.forEach(cmd => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });

  let help = "📋 **Available Commands:**\\n\\n";

  Object.keys(categories).sort().forEach(cat => {
    help += \`**\${cat.toUpperCase()}:**\\n\`;

    categories[cat].forEach(cmd => {
      help += \`• /\${cmd.name}\`;

      if (cmd.parameters.length > 0) {
        const params = cmd.parameters.map(p => {
          return p.required ? \`<\${p.name}>\` : \`[\${p.name}]\`;
        }).join(' ');
        help += \` \${params}\`;
      }

      help += \` - \${cmd.description}\`;

      if (cmd.example) {
        help += \`\\n  Example: \${cmd.example}\`;
      }

      help += '\\n';
    });
    help += '\\n';
  });

  return help;
}
`;

createFile('lib/services/commandRegistry.js', commandRegistryContent);

// 2. initDatabase.js (versión simplificada)
const initDatabaseContent = `// lib/services/initDatabase.js
import { query } from "@/lib/db";
import { initializeMembersTable } from "./memberService";

export async function initializeDatabase() {
  console.log("🚀 Starting database initialization...");

  try {
    await initializeMembersTable();
    console.log("✅ Database initialization completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Fatal error during database initialization:", error);
    throw error;
  }
}

export async function checkDatabaseHealth() {
  const tables = ['team_members', 'tasks'];
  const health = {
    status: 'healthy',
    tables: {},
    timestamp: new Date().toISOString()
  };

  for (const table of tables) {
    try {
      const result = await query(\`SELECT COUNT(*) as count FROM \${table};\`);
      health.tables[table] = {
        exists: true,
        rowCount: parseInt(result.rows[0].count)
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.tables[table] = {
        exists: false,
        error: error.message
      };
    }
  }

  return health;
}
`;

createFile('lib/services/initDatabase.js', initDatabaseContent);

// 3. memberCommands.js (versión simplificada pero funcional)
const memberCommandsContent = `// lib/commands/memberCommands.js
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
        \`Please reply to a user's message with /addMember! \${getRandomKaomoji()}\`,
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
      \`✅ Member added successfully! \${getRandomKaomoji()}\\n\\n\${escapeHTML(firstName)} is now part of the team!\`,
      "HTML"
    );

    return { success: true, member: addedMember };
  } catch (error) {
    console.error("Error in handleAddMember:", error);
    await sendMessage(chatId, \`Error: \${escapeHTML(error.message)}\`, "HTML");
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
      await sendMessage(chatId, \`✅ Member removed! \${getRandomKaomoji()}\`, "HTML");
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
        \`📋 \${bold("Team Members")}\\n\\nThe team is empty! Add members with /addMember\`,
        "HTML"
      );
      return { success: true, members: [] };
    }

    let message = \`📋 \${bold("Team Members")} (\${members.length})\\n\\n\`;

    members.forEach((member, index) => {
      const displayName = member.custom_name || member.first_name || member.username || \`User \${member.user_id}\`;
      message += \`\${index + 1}. \${escapeHTML(displayName)}\`;
      if (member.role) {
        message += \` - \${escapeHTML(member.role)}\`;
      }
      message += '\\n';
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

    let message = \`📊 \${bold("Team Statistics")}\\n\\n\`;
    message += \`Total Members: \${stats.total_members}\\n\`;

    await sendMessage(chatId, message, "HTML");
    return { success: true, stats };
  } catch (error) {
    console.error("Error in handleTeamStats:", error);
    return { success: false, error: error.message };
  }
}
`;

createFile('lib/commands/memberCommands.js', memberCommandsContent);

console.log('\n✅ All files created successfully!');
console.log('\nNext steps:');
console.log('1. Run: git add .');
console.log('2. Run: git commit -m "feat: Add missing files for v2.0"');
console.log('3. Run: git push origin master');
console.log('\nOr simply run: commit-changes.bat');
