// lib/services/commandRegistry.js

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
 * @param {Object} commandConfig - Command configuration
 * @param {string} commandConfig.name - Command name (without /)
 * @param {string} commandConfig.description - What the command does
 * @param {Array<Object>} commandConfig.parameters - Command parameters
 * @param {Function} commandConfig.handler - Function to execute the command
 * @param {Array<string>} [commandConfig.aliases] - Alternative names
 * @param {string} [commandConfig.category] - Command category
 * @param {boolean} [commandConfig.requiresAdmin] - If admin rights are needed
 * @param {string} [commandConfig.example] - Usage example
 */
export function registerCommand(commandConfig) {
  const {
    name,
    description,
    parameters = [],
    handler,
    aliases = [],
    category = "general",
    requiresAdmin = false,
    example = "",
  } = commandConfig;

  if (!name || !handler) {
    throw new Error("Command name and handler are required");
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
  aliases.forEach((alias) => {
    commands.set(alias, { ...command, isAlias: true, aliasOf: name });
  });

  console.log(`✅ Command registered: /${name}`);
}

/**
 * Gets a command by name or alias
 * @param {string} commandName - Command name (without /)
 * @returns {Object|null} Command object or null
 */
export function getCommand(commandName) {
  return commands.get(commandName) || null;
}

/**
 * Gets all registered commands
 * @returns {Array<Object>} Array of all commands
 */
export function getAllCommands() {
  const allCommands = [];
  commands.forEach((command, name) => {
    // Skip aliases in the main list
    if (!command.isAlias) {
      allCommands.push({ name, ...command });
    }
  });
  return allCommands;
}

/**
 * Gets commands by category
 * @param {string} category - Category name
 * @returns {Array<Object>} Commands in that category
 */
export function getCommandsByCategory(category) {
  return getAllCommands().filter((cmd) => cmd.category === category);
}

/**
 * Executes a command programmatically
 * @param {string} commandName - Command name (without /)
 * @param {Object} context - Execution context
 * @param {number} context.chatId - Chat ID
 * @param {number} context.userId - User ID who triggered
 * @param {string} [context.username] - Username
 * @param {Object} context.message - Full message object
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Execution result
 */
export async function executeCommand(commandName, context, params = {}) {
  const command = getCommand(commandName);

  if (!command) {
    throw new Error(`Command not found: ${commandName}`);
  }

  // If it's an alias, get the original command
  const actualCommand = command.isAlias ? getCommand(command.aliasOf) : command;

  try {
    console.log(`🤖 AI executing command: /${commandName}`, params);

    // Validate required parameters
    const missingParams = actualCommand.parameters
      .filter((p) => p.required && !params[p.name])
      .map((p) => p.name);

    if (missingParams.length > 0) {
      return {
        success: false,
        error: `Missing required parameters: ${missingParams.join(", ")}`,
        command: commandName,
      };
    }

    // Execute the command handler
    const result = await actualCommand.handler(context, params);

    return {
      success: true,
      command: commandName,
      result,
    };
  } catch (error) {
    console.error(`❌ Error executing command /${commandName}:`, error);
    return {
      success: false,
      error: error.message,
      command: commandName,
    };
  }
}

/**
 * Generates a formatted list of all commands for the AI
 * This is used in the system prompt so the AI knows what it can do
 * @returns {string} Formatted command list
 */
export function getCommandsForAIPrompt() {
  const commandsList = getAllCommands();

  if (commandsList.length === 0) {
    return "No commands registered yet.";
  }

  const categories = {};
  commandsList.forEach((cmd) => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });

  let prompt =
    "🤖 **AVAILABLE COMMANDS** - You can execute these commands by detecting user intent:\n\n";

  Object.keys(categories)
    .sort()
    .forEach((category) => {
      prompt += `**${category.toUpperCase()}:**\n`;

      categories[category].forEach((cmd) => {
        prompt += `• /${cmd.name}`;

        if (cmd.parameters.length > 0) {
          const params = cmd.parameters
            .map((p) => {
              const paramName = p.required ? `<${p.name}>` : `[${p.name}]`;
              return paramName;
            })
            .join(" ");
          prompt += ` ${params}`;
        }

        prompt += `\n  Description: ${cmd.description}`;

        if (cmd.parameters.length > 0) {
          prompt += `\n  Parameters:`;
          cmd.parameters.forEach((p) => {
            prompt += `\n    - ${p.name} (${p.type})${p.required ? " [REQUIRED]" : " [OPTIONAL]"}: ${p.description}`;
          });
        }

        if (cmd.example) {
          prompt += `\n  Example: ${cmd.example}`;
        }

        if (cmd.aliases.length > 0) {
          prompt += `\n  Aliases: ${cmd.aliases.map((a) => `/${a}`).join(", ")}`;
        }

        prompt += "\n\n";
      });
    });

  prompt += `\n**🎯 IMPORTANT FOR AI:**
- When a user asks you to do something that matches a command, YOU CAN EXECUTE IT DIRECTLY
- Don't just tell the user the command syntax - EXECUTE IT FOR THEM
- Extract parameters from the user's message context
- Example: User says "assign these tasks: fix bug, write docs" → You execute /assign with those tasks
- Example: User says "add John to the team" → You execute /addMember for John
- Always confirm what you're doing: "I'll add those tasks for you!" then execute
- If you need more info for required parameters, ASK before executing\n`;

  return prompt;
}

/**
 * Parses a text command and extracts command name and arguments
 * @param {string} text - Message text
 * @returns {Object|null} Parsed command or null
 */
export function parseCommand(text) {
  if (!text || !text.startsWith("/")) {
    return null;
  }

  const parts = text.trim().split(/\s+/);
  const commandPart = parts[0].substring(1).toLowerCase(); // Remove /
  const args = parts.slice(1).join(" ");

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
 * @param {string} commandName - Command name (without /)
 * @returns {boolean}
 */
export function commandExists(commandName) {
  return commands.has(commandName);
}

/**
 * Unregisters a command (useful for testing or dynamic commands)
 * @param {string} commandName - Command name (without /)
 * @returns {boolean} true if removed
 */
export function unregisterCommand(commandName) {
  const command = commands.get(commandName);
  if (!command) {
    return false;
  }

  // Remove aliases
  if (command.aliases) {
    command.aliases.forEach((alias) => commands.delete(alias));
  }

  commands.delete(commandName);
  console.log(`🗑️ Command unregistered: /${commandName}`);
  return true;
}

/**
 * Gets command statistics
 * @returns {Object} Stats about registered commands
 */
export function getCommandStats() {
  const allCommands = getAllCommands();
  const categories = new Set(allCommands.map((cmd) => cmd.category));
  const aliasCount = Array.from(commands.values()).filter(
    (cmd) => cmd.isAlias,
  ).length;

  return {
    totalCommands: allCommands.length,
    totalAliases: aliasCount,
    categories: Array.from(categories),
    categoryCount: categories.size,
  };
}

/**
 * Generates a help message for users (not for AI)
 * @param {string} [category] - Optional category filter
 * @returns {string} Formatted help message
 */
export function generateHelpMessage(category = null) {
  let commandsList = getAllCommands();

  if (category) {
    commandsList = commandsList.filter((cmd) => cmd.category === category);
  }

  if (commandsList.length === 0) {
    return "No commands available.";
  }

  const categories = {};
  commandsList.forEach((cmd) => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });

  let help = "📋 **Available Commands:**\n\n";

  Object.keys(categories)
    .sort()
    .forEach((cat) => {
      help += `**${cat.toUpperCase()}:**\n`;

      categories[cat].forEach((cmd) => {
        help += `• /${cmd.name}`;

        if (cmd.parameters.length > 0) {
          const params = cmd.parameters
            .map((p) => {
              return p.required ? `&lt;${p.name}&gt;` : `[${p.name}]`;
            })
            .join(" ");
          help += ` ${params}`;
        }

        help += ` - ${cmd.description}`;

        if (cmd.example) {
          help += `\n  Example: ${cmd.example}`;
        }

        help += "\n";
      });
      help += "\n";
    });

  return help;
}

/**
 * Validates command parameters against their schema
 * @param {Object} command - Command object
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
export function validateCommandParams(command, params) {
  const errors = [];
  const warnings = [];

  command.parameters.forEach((paramDef) => {
    const value = params[paramDef.name];

    // Check required parameters
    if (
      paramDef.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors.push(`Parameter '${paramDef.name}' is required`);
      return;
    }

    // Type validation (basic)
    if (value !== undefined && value !== null) {
      const actualType = typeof value;
      if (paramDef.type === "number" && actualType !== "number") {
        errors.push(`Parameter '${paramDef.name}' must be a number`);
      } else if (paramDef.type === "boolean" && actualType !== "boolean") {
        errors.push(`Parameter '${paramDef.name}' must be a boolean`);
      } else if (paramDef.type === "array" && !Array.isArray(value)) {
        errors.push(`Parameter '${paramDef.name}' must be an array`);
      }
    }

    // Validation function if provided
    if (paramDef.validate && value !== undefined) {
      const validationResult = paramDef.validate(value);
      if (validationResult !== true) {
        errors.push(validationResult || `Invalid value for '${paramDef.name}'`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
