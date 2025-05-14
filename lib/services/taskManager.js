// lib/services/taskManager.js
import { v4 as uuidv4 } from 'uuid';
// Asegúrate de que la ruta de importación sea correcta y que htmlEscaper.js
// contenga las funciones escapeHTML, bold, code, mention, etc.
import { escapeHTML, bold, code, mention } from '@/lib/utils/htmlEscaper';

// --- Simulación de Base de Datos ---
// ¡¡¡REEMPLAZAR CON UNA BASE DE DATOS REAL EN PRODUCCIÓN!!!
let tasksDB = []; // Array de objetos Task: {id, description, assigned_to_name, assigned_to_id, ...}
// ---------------------------------

const TEAM_MEMBERS = {
  'Raydel': parseInt(process.env.USER_ID_RAYDEL || '0'),
  'Claudia': parseInt(process.env.USER_ID_CLAUDIA || '0'),
  'Grettel': parseInt(process.env.USER_ID_GRETTEL || '0'),
  'Ernesto': parseInt(process.env.USER_ID_ERNESTO || '0'),
  'Javier': parseInt(process.env.USER_ID_JAVIER || '0'),
};
const activeTeamMemberNames = Object.keys(TEAM_MEMBERS).filter(name => TEAM_MEMBERS[name] !== 0);


// lib/services/taskManager.js (o un nuevo archivo)

// ... (otras importaciones y código) ...

// --- Simulación de Memoria para el Trabajo Fijado ---
// ¡¡¡REEMPLAZAR CON UNA BASE DE DATOS REAL EN PRODUCCIÓN PARA PERSISTENCIA!!!
let pinnedWork = { // Solo puede haber un trabajo fijado a la vez en esta simulación
  chatId: null,    // ID del chat donde está el mensaje original del documento
  messageId: null, // ID del mensaje original que contiene el documento
  fileId: null,    // file_id del documento (útil para reenviar por file_id)
  fileName: null,  // Nombre del archivo (opcional, para mostrar)
  caption: null,   // Caption del mensaje original (opcional)
  pinnedBy: null,  // ID del usuario que lo fijó (opcional, para auditoría)
  pinnedAt: null   // Timestamp de cuándo se fijó (opcional)
};
// ----------------------------------------------------

export async function setPinnedWork(chatId, messageId, document, userId) {
  if (!document || (!document.file_id && !document.document?.file_id)) { // document puede ser el objeto directo o anidado
    return { success: false, message: "⚠️ El mensaje respondido no parece contener un documento válido." };
  }
  
  const docFile = document.document || document; // Telegram a veces anida 'document'

  pinnedWork = {
    chatId: chatId,
    messageId: messageId, // ID del mensaje al que se respondió (que contiene el doc)
    fileId: docFile.file_id,
    fileName: docFile.file_name || "documento_fijado.doc",
    caption: document.caption || null, // Caption del mensaje original del documento
    pinnedBy: userId,
    pinnedAt: new Date().toISOString()
  };
  console.log("Trabajo Fijado:", pinnedWork);
  // En una DB real: await db.pinnedWork.upsert({ where: { some_unique_key_per_bot_or_chat }, create: pinnedWork, update: pinnedWork });
  return { success: true, message: `📄 ¡Documento "${escapeHTML(pinnedWork.fileName)}" fijado como el trabajo actual!` };
}

export async function getPinnedWork() {
  if (pinnedWork.fileId) {
    return { success: true, work: pinnedWork };
  }
  return { success: false, message: `ℹ️ No hay ningún documento de trabajo fijado actualmente. Responde a un mensaje con un documento .doc usando ${code("/trabajo")} para fijarlo.` };
}

// Opcional: Limpiar el trabajo fijado
export async function clearPinnedWork(userId) {
  // TODO: Añadir verificación de permisos si es necesario
  if (pinnedWork.fileId) {
    const oldWorkName = pinnedWork.fileName;
    pinnedWork = { chatId: null, messageId: null, fileId: null, fileName: null, caption: null, pinnedBy: null, pinnedAt: null };
    return { success: true, message: `🗑️ El trabajo "${escapeHTML(oldWorkName)}" ha sido desfijado.` };
  }
  return { success: true, message: "🤷 No había ningún trabajo fijado para desfijar." };
}

// Helper para barajar un array (Fisher-Yates shuffle)
function shuffleArray(array) {
  const newArray = [...array]; // Crear una copia para no modificar el original
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Intercambiar elementos
  }
  return newArray;
}

// ----- Funciones CRUD simuladas -----
function findTaskById(id) {
  return tasksDB.find(task => task.id === id);
}

function getPendingTasksFromDB() {
  return tasksDB.filter(task => !task.completed);
}

function saveTaskToDB(task) {
  const index = tasksDB.findIndex(t => t.id === task.id);
  if (index > -1) {
    tasksDB[index] = task; // Update
  } else {
    tasksDB.push(task); // Create
  }
  // Para depuración, puedes ver cómo se ve la "base de datos":
  // console.log("Tasks DB (simulada):", tasksDB.map(t => ({id: t.id, desc: t.description, to: t.assigned_to_name, completed: t.completed })));
}

export function clear_tasks() {
    tasksDB = [];
    return true;
}
// ------------------------------------

export async function assignTasks(chatId, taskDescriptions) {
  if (!activeTeamMemberNames.length) {
    return { message: "⚠️ No hay miembros del equipo configurados correctamente.", assignedTasksData: [] };
  }
  if (!taskDescriptions || taskDescriptions.length === 0) {
    return { message: "Por favor, proporciona descripciones para las tareas.", assignedTasksData: [] };
  }

  const numTasks = taskDescriptions.length;
  const numMembers = activeTeamMemberNames.length;
  const newlyAssignedTasks = [];
  let assignmentsText = ""; // Se construirá con HTML

  // Lógica de distribución equitativa y aleatoria
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
      description: desc.trim(), // Guardar descripción original sin escapar
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
    
    // Usar helper de mención HTML y escapar la descripción de la tarea
    assignmentsText += `  🔹 ${escapeHTML(desc.trim())} ➡️ ${mention(memberName, memberId)}\n`;
  });

  // Construir el mensaje de respuesta usando helpers HTML
  const responseMessage = 
    `✅ ${bold("Tareas Asignadas Equitativa y Aleatoriamente:")}\n\n` +
    `${assignmentsText}\n` + // assignmentsText ya tiene menciones HTML y descripciones escapadas
    `Recuerden marcar las tareas como completadas usando ${code("/completar SU_ID_DE_TAREA")}.`; // Placeholder sin < >
    
  // Devolver el mensaje HTML y el array de tareas original
  return { message: responseMessage, assignedTasksData: newlyAssignedTasks };
}

export async function completeTask(taskId, completingUserId) {
  const task = findTaskById(taskId);
  if (!task) {
    return `❌ No se encontró la tarea con ID ${code(taskId)}.`;
  }
  if (task.completed) {
    return `🤔 La tarea '${escapeHTML(task.description)}' (${code(taskId)}) ya estaba completada.`;
  }

  // const ADMIN_ID = parseInt(process.env.ADMIN_USER_ID || '0');
  if (task.assigned_to_id !== completingUserId /* && completingUserId !== ADMIN_ID */) {
     // Usar el helper mention
     return `❌ Solo ${mention(task.assigned_to_name, task.assigned_to_id)} o un admin puede marcar esta tarea.`;
  }

  task.completed = true;
  task.completed_at = new Date().toISOString();
  saveTaskToDB(task);
  return `✅ ¡Bien hecho! Tarea '${escapeHTML(task.description)}' (${code(taskId)}) marcada como completada por ${bold(escapeHTML(task.assigned_to_name))}.`;
}

export async function getPendingTasksSummary() {
  const pending = getPendingTasksFromDB();
  if (!pending.length) {
    return "🎉 ¡No hay tareas pendientes! ¡Buen trabajo equipo!";
  }

  let summary = `📋 ${bold("Resumen de Tareas Pendientes:")}\n`;
  pending.forEach(task => {
    summary += (
      `\n🔹 ${code(task.id)}: ${escapeHTML(task.description)} ` +
      `(Asignada a: ${mention(task.assigned_to_name, task.assigned_to_id)})` +
      ` - Toca para marcarla: ${code(`/completar_${task.id}`)}` // Esto es para copiar, está bien
    );
  });
  return summary;
}

export async function getTasksForDailyReminder() {
    return getPendingTasksFromDB();
}