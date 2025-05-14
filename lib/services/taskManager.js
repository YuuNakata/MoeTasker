// lib/services/taskManager.js
import { v4 as uuidv4 } from 'uuid';
import { escapeHTML, bold, italic, code, mention, link } from '@/lib/utils/htmlEscaper';

// --- Simulación de Base de Datos ---
// ¡¡¡REEMPLAZAR CON UNA BASE DE DATOS REAL EN PRODUCCIÓN!!!
let tasksDB = []; // Array de objetos Task
// ---------------------------------

const TEAM_MEMBERS = {
  'Raydel': parseInt(process.env.USER_ID_RAYDEL || '0'),
  'Claudia': parseInt(process.env.USER_ID_CLAUDIA || '0'),
  'Grettel': parseInt(process.env.USER_ID_GRETTEL || '0'),
  'Ernesto': parseInt(process.env.USER_ID_ERNESTO || '0'),
  'Javier': parseInt(process.env.USER_ID_JAVIER || '0'),
};
const activeTeamMemberNames = Object.keys(TEAM_MEMBERS).filter(name => TEAM_MEMBERS[name] !== 0);

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function findTaskById(id) {
  return tasksDB.find(task => task.id === id);
}

function getPendingTasksFromDB() {
  return tasksDB.filter(task => !task.completed);
}

function saveTaskToDB(task) {
  const index = tasksDB.findIndex(t => t.id === task.id);
  if (index > -1) tasksDB[index] = task;
  else tasksDB.push(task);
  // console.log("Tasks DB (simulada):", tasksDB.map(t => ({desc: t.description, to: t.assigned_to_name})));
}

export async function assignTasks(chatId, taskDescriptions) {
  if (!activeTeamMemberNames.length) {
    return { message: "⚠️ No hay miembros del equipo configurados correctamente.", assignedTasksData: [] };
  }
  if (!taskDescriptions.length) {
    return { message: "Por favor, proporciona descripciones para las tareas.", assignedTasksData: [] };
  }

  const numTasks = taskDescriptions.length;
  const numMembers = activeTeamMemberNames.length;
  const newlyAssignedTasks = [];
  let assignmentsText = "";

  let assignmentPool = [];
  const baseTasksPerMember = Math.floor(numTasks / numMembers);
  for (let i = 0; i < numMembers; i++) {
    for (let j = 0; j < baseTasksPerMember; j++) {
      assignmentPool.push(activeTeamMemberNames[i]);
    }
  }

  let remainingTasks = numTasks % numMembers;
  const membersForExtraTasks = shuffleArray([...activeTeamMemberNames]);
  for (let i = 0; i < remainingTasks; i++) {
    assignmentPool.push(membersForExtraTasks[i]);
  }

  const finalShuffledAssignmentPool = shuffleArray(assignmentPool);

  taskDescriptions.forEach((desc, index) => {
    const memberName = finalShuffledAssignmentPool[index];
    const memberId = TEAM_MEMBERS[memberName];

    const newTask = {
      id: uuidv4().substring(0, 8),
      description: desc.trim(),
      assigned_to_name: memberName,
      assigned_to_id: memberId,
      assigned_at: new Date().toISOString(),
      due_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 día después
      completed: false,
      completed_at: null,
      chat_id: chatId,
    };
    saveTaskToDB(newTask);
    newlyAssignedTasks.push(newTask);
    // Enlace para MarkdownV2: [texto](tg://user?id=ID)
    assignmentsText += `  🔹 ${escapeHTML(desc.trim())} ➡️ [${escapeHTML(memberName)}](tg://user?id=${memberId})\n`;
  });

  const responseMessage = `✅ *Tareas Asignadas Equitativa y Aleatoriamente:*\n\n${assignmentsText}\nRecuerden marcar las tareas como completadas usando \`/completar <id_tarea>\`.`;
  return { message: escapeHTML(responseMessage), assignedTasksData: escapeHTML(newlyAssignedTasks) };
}

export async function completeTask(taskId, completingUserId) {
  const task = findTaskById(taskId);
  if (!task) return `❌ No se encontró la tarea con ID \`${taskId}\`.`;
  if (task.completed) return `🤔 La tarea '${escapeHTML(task.description)}' (\`${taskId}\`) ya estaba completada.`;

  if (task.assigned_to_id !== completingUserId) {
     return `❌ Solo [${escapeHTML(task.assigned_to_name)}](tg://user?id=${task.assigned_to_id}) o un admin puede marcar esta tarea.`;
  }

  task.completed = true;
  task.completed_at = new Date().toISOString();
  saveTaskToDB(task);
  return `✅ ¡Bien hecho! Tarea '${escapeHTML(task.description)}' (\`${taskId}\`) marcada como completada por ${escapeHTML(task.assigned_to_name)}.`;
}

export async function getPendingTasksSummary() {
  const pending = getPendingTasksFromDB();
  if (!pending.length) return "🎉 ¡No hay tareas pendientes! ¡Buen trabajo equipo!";

  let summary = "📋 *Resumen de Tareas Pendientes:*\n";
  pending.forEach(task => {
    summary += (
      `\n🔹 \`${task.id}\`: ${escapeHTML(task.description)} ` +
      `(Asignada a: [${escapeHTML(task.assigned_to_name)}](tg://user?id=${task.assigned_to_id}))` +
      ` - Toca para marcarla: \`/completar_${task.id}\`` // Telegram hace copiable el código
    );
  });
  return summary;
}

export async function getTasksForDailyReminder() {
    return getPendingTasksFromDB();
}