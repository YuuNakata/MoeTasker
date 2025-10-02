// lib/commands/taskCommands.js
import * as TaskManager from "@/lib/services/taskManager";
import * as MemberService from "@/lib/services/memberService";
import { escapeHTML, bold, code, mention } from "@/lib/utils/htmlEscaper";
import { sendMessage } from "@/utils/telegram";
import { getRandomKaomoji } from "@/lib/services/moeHandler";

/**
 * Handler para /assign
 * Asigna tareas a los miembros del equipo
 *
 * Uso:
 * - /assign Task 1, Task 2, Task 3
 * - /assign Tarea 1, Tarea 2
 */
export async function handleAssign(context, params) {
  const { chatId, userId } = context;
  let tasksText = params.tasks || params.args || "";

  try {
    if (!tasksText || tasksText.trim() === "") {
      await sendMessage(
        chatId,
        `Please provide the tasks to assign! ${getRandomKaomoji()}\n\n` +
          `Usage: ${code("/assign Task 1, Task 2, Task 3")}\n\n` +
          `Example:\n` +
          `${code("/assign Fix bug #123, Write documentation, Deploy to production")}`,
        "HTML"
      );
      return { success: false, error: "No tasks provided" };
    }

    // Parsear las tareas (separadas por coma)
    const tasks = tasksText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tasks.length === 0) {
      await sendMessage(
        chatId,
        `I couldn't find any valid tasks. ${getRandomKaomoji()}\n\n` +
          `Make sure to separate tasks with commas.`,
        "HTML"
      );
      return { success: false, error: "No valid tasks" };
    }

    // Verificar que hay miembros en el equipo
    const members = await MemberService.getAllMembers(chatId);
    if (members.length === 0) {
      await sendMessage(
        chatId,
        `The team is empty! ${getRandomKaomoji()}\n\n` +
          `Add members first using ${code("/addMember")} before assigning tasks.`,
        "HTML"
      );
      return { success: false, error: "No team members" };
    }

    // Asignar las tareas
    const result = await TaskManager.assignTasks(chatId, tasks);

    if (result && result.message) {
      await sendMessage(chatId, result.message, "HTML");
      return {
        success: true,
        tasksAssigned: result.assignedTasksData || tasks.length,
      };
    } else {
      await sendMessage(
        chatId,
        `Something went wrong assigning tasks. ${getRandomKaomoji()}`,
        "HTML"
      );
      return { success: false, error: "Assignment failed" };
    }
  } catch (error) {
    console.error("Error in handleAssign:", error);
    await sendMessage(
      chatId,
      `Oops! Something went wrong assigning the tasks. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handler para /tasks
 * Lista todas las tareas pendientes
 */
export async function handleTasks(context, params) {
  const { chatId } = context;

  try {
    const summary = await TaskManager.getPendingTasksSummary(chatId);

    await sendMessage(chatId, summary, "HTML");

    return { success: true };
  } catch (error) {
    console.error("Error in handleTasks:", error);
    await sendMessage(
      chatId,
      `Oops! I couldn't retrieve the task list. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handler para /complete
 * Marca una tarea como completada
 *
 * Uso:
 * - /complete TASK_ID
 * - /complete abc123
 */
export async function handleComplete(context, params) {
  const { chatId, userId } = context;
  let taskId = params.taskId || params.args || "";

  try {
    taskId = taskId.trim();

    if (!taskId) {
      await sendMessage(
        chatId,
        `Please provide the task ID to complete! ${getRandomKaomoji()}\n\n` +
          `Usage: ${code("/complete TASK_ID")}\n\n` +
          `Example: ${code("/complete abc123")}\n\n` +
          `Use ${code("/tasks")} to see all pending tasks with their IDs.`,
        "HTML"
      );
      return { success: false, error: "No task ID provided" };
    }

    const result = await TaskManager.completeTask(chatId, taskId, userId);

    await sendMessage(chatId, result, "HTML");

    // Check if it was successful (starts with ✅)
    const success = result.startsWith("✅");

    return {
      success,
      taskId,
      message: result,
    };
  } catch (error) {
    console.error("Error in handleComplete:", error);
    await sendMessage(
      chatId,
      `Oops! Something went wrong completing the task. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handler para /clearTasks
 * Limpia todas las tareas pendientes (requiere permisos)
 */
export async function handleClearTasks(context, params) {
  const { chatId, userId } = context;

  try {
    // TODO: Verificar permisos de admin
    // const isAdmin = await verifyAdmin(chatId, userId);
    // if (!isAdmin) {
    //   await sendMessage(
    //     chatId,
    //     `Sorry, only admins can clear all tasks. ${getRandomKaomoji()}`,
    //     "HTML"
    //   );
    //   return { success: false, error: "Insufficient permissions" };
    // }

    const cleared = await TaskManager.clear_tasks(chatId);

    let message;
    if (cleared) {
      message = `✅ All tasks have been cleared! ${getRandomKaomoji()}`;
    } else {
      message = `Oops, I couldn't clear the tasks this time... ${getRandomKaomoji()}`;
    }

    await sendMessage(chatId, message, "HTML");

    return { success: cleared };
  } catch (error) {
    console.error("Error in handleClearTasks:", error);
    await sendMessage(
      chatId,
      `Oops! Something went wrong clearing the tasks. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handler para /myTasks
 * Muestra las tareas asignadas al usuario que ejecuta el comando
 */
export async function handleMyTasks(context, params) {
  const { chatId, userId, message } = context;
  const userName = message.from.first_name || "User";

  try {
    const myTasks = await TaskManager.getUserTasks(chatId, userId);

    if (!myTasks || myTasks.length === 0) {
      await sendMessage(
        chatId,
        `You don't have any pending tasks, ${escapeHTML(userName)}! ${getRandomKaomoji()}\n\n` +
          `Enjoy your free time! ✨`,
        "HTML"
      );
      return { success: true, taskCount: 0 };
    }

    let message = `📋 ${bold("Your Pending Tasks")} (${myTasks.length})\n\n`;

    myTasks.forEach((task, index) => {
      message += `${index + 1}. ${escapeHTML(task.description)}\n`;
      message += `   ID: ${code(task.id)}\n`;
      message += `   Assigned: ${new Date(task.created_at).toLocaleDateString()}\n\n`;
    });

    message += `Use ${code("/complete TASK_ID")} to mark a task as done! ${getRandomKaomoji()}`;

    await sendMessage(chatId, message, "HTML");

    return { success: true, taskCount: myTasks.length };
  } catch (error) {
    console.error("Error in handleMyTasks:", error);
    await sendMessage(
      chatId,
      `Oops! I couldn't retrieve your tasks. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}

/**
 * Handler para /taskStats
 * Muestra estadísticas de las tareas
 */
export async function handleTaskStats(context, params) {
  const { chatId } = context;

  try {
    const stats = await TaskManager.getTaskStats(chatId);

    let message = `📊 ${bold("Task Statistics")} ${getRandomKaomoji()}\n\n`;
    message += `Total Tasks: ${stats.total}\n`;
    message += `Pending: ${stats.pending}\n`;
    message += `Completed: ${stats.completed}\n`;

    if (stats.total > 0) {
      const completionRate = ((stats.completed / stats.total) * 100).toFixed(1);
      message += `\nCompletion Rate: ${completionRate}%\n`;
    }

    if (stats.topContributor) {
      message += `\n${bold("Top Contributor:")} ${escapeHTML(stats.topContributor.name)} (${stats.topContributor.completed} tasks completed)\n`;
    }

    await sendMessage(chatId, message, "HTML");

    return { success: true, stats };
  } catch (error) {
    console.error("Error in handleTaskStats:", error);
    await sendMessage(
      chatId,
      `Oops! I couldn't retrieve task statistics. ${getRandomKaomoji()}\n\n` +
        `Error: ${escapeHTML(error.message)}`,
      "HTML"
    );
    return { success: false, error: error.message };
  }
}
