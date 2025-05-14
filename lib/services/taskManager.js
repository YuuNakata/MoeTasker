// lib/services/taskManager.js
import { query, query } from '@/lib/db'; // Importar nuestra función de query para PostgreSQL
import { escapeHTML, bold, code, mention } from '@/lib/utils/htmlEscaper';
import { v4 as uuidv4 } from 'uuid';

const TEAM_MEMBERS = {
  'Raydel': parseInt(process.env.USER_ID_RAYDEL || '0'),
  'Claudia': parseInt(process.env.USER_ID_CLAUDIA || '0'),
  'Grettel': parseInt(process.env.USER_ID_GRETTEL || '0'),
  'Ernesto': parseInt(process.env.USER_ID_ERNESTO || '0'),
  'Javier': parseInt(process.env.USER_ID_JAVIER || '0'),
};
const activeTeamMemberNames = Object.keys(TEAM_MEMBERS).filter(name => TEAM_MEMBERS[name] !== 0);

// Helper para barajar un array (Fisher-Yates shuffle)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}


export async function clear_tasks() {
  await query("DELETE * FROM tasks");
  return true;
}

export async function assignTasks(chatId, taskDescriptions) {
  if (!activeTeamMemberNames.length) {
    return { message: "⚠️ No hay miembros del equipo configurados correctamente.", assignedTasksData: [] };
  }
  if (!taskDescriptions || taskDescriptions.length === 0) {
    return { message: "Por favor, proporciona descripciones para las tareas.", assignedTasksData: [] };
  }

  const numTasks = taskDescriptions.length;
  const numMembers = activeTeamMemberNames.length;
  const newlyAssignedTasksData = [];
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

  for (let i = 0; i < taskDescriptions.length; i++) {
    const desc = taskDescriptions[i];
    const memberName = finalShuffledAssignmentPool[i];
    const memberId = TEAM_MEMBERS[memberName];
    const taskId = uuidv4().substring(0, 8);

    const newTaskData = {
      id: taskId,
      description: desc.trim(),
      assigned_to_name: memberName,
      assigned_to_id: memberId,
      assigned_at: new Date().toISOString(),
      due_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 día después
      completed: false,
      completed_at: null,
      chat_id: chatId,
    };

    try {
      await query(
        'INSERT INTO tasks (id, description, assigned_to_name, assigned_to_id, assigned_at, due_by, completed, chat_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [newTaskData.id, newTaskData.description, newTaskData.assigned_to_name, newTaskData.assigned_to_id, newTaskData.assigned_at, newTaskData.due_by, newTaskData.completed, newTaskData.chat_id]
      );
      newlyAssignedTasksData.push(newTaskData);
      assignmentsText += `  🔹 ${escapeHTML(desc.trim())} ➡️ ${mention(memberName, memberId)}\n`;
    } catch (error) {
      console.error(`DB Error (assignTasks - INSERT): Fallo al insertar tarea '${escapeHTML(desc.trim())}'.`, error);
      // Considerar cómo manejar esto. ¿Notificar al usuario? ¿Revertir otras tareas?
      // Por ahora, el bucle continuará con las siguientes tareas.
    }
  }
  
  const responseMessage = 
    `✅ ${bold("Tareas Asignadas Equitativa y Aleatoriamente:")}\n\n` +
    `${assignmentsText}\n` +
    `Recuerden marcar las tareas como completadas usando ${code("/completar SU_ID_DE_TAREA")}.`;
    
  return { message: responseMessage, assignedTasksData: newlyAssignedTasksData };
}

export async function completeTask(taskId, completingUserId) {
  try {
    const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) {
      return `❌ No se encontró la tarea con ID ${code(taskId)}.`;
    }
    const task = taskRes.rows[0];

    if (task.completed) {
      return `🤔 La tarea '${escapeHTML(task.description)}' (${code(taskId)}) ya estaba completada.`;
    }

    // const ADMIN_ID = parseInt(process.env.ADMIN_USER_ID || '0');
    if (task.assigned_to_id !== completingUserId /* && completingUserId !== ADMIN_ID */) {
       return `❌ Solo ${mention(task.assigned_to_name, task.assigned_to_id)} o un admin puede marcar esta tarea.`;
    }

    await query(
      'UPDATE tasks SET completed = TRUE, completed_at = NOW() WHERE id = $1',
      [taskId]
    );
    return `✅ ¡Bien hecho! Tarea '${escapeHTML(task.description)}' (${code(taskId)}) marcada como completada por ${bold(escapeHTML(task.assigned_to_name))}.`;
  } catch (error) {
    console.error(`DB Error (completeTask): Fallo al completar tarea ${taskId}.`, error);
    return `⚠️ Ocurrió un error al intentar completar la tarea. Por favor, inténtalo de nuevo.`;
  }
}

export async function getPendingTasksSummary() {
  try {
    const res = await query('SELECT id, description, assigned_to_name, assigned_to_id FROM tasks WHERE completed = FALSE ORDER BY assigned_at ASC');
    const pending = res.rows;

    if (!pending.length) {
      return "🎉 ¡No hay tareas pendientes! ¡Buen trabajo equipo!";
    }

    let summary = `📋 ${bold("Resumen de Tareas Pendientes:")}\n`;
    pending.forEach(task => {
      summary += (
        `\n🔹 ${code(task.id)}: ${escapeHTML(task.description)} ` +
        `(Asignada a: ${mention(task.assigned_to_name, task.assigned_to_id)})` +
        ` - Toca para marcarla: ${code(`/completar_${task.id}`)}`
      );
    });
    return summary;
  } catch (error) {
    console.error("DB Error (getPendingTasksSummary): Fallo al obtener resumen.", error);
    return "⚠️ Ocurrió un error al obtener las tareas pendientes.";
  }
}

export async function getTasksForDailyReminder() {
  try {
    // Seleccionar solo los campos necesarios para el recordatorio
    const res = await query('SELECT id, description, assigned_to_name, assigned_to_id, chat_id FROM tasks WHERE completed = FALSE ORDER BY assigned_at ASC');
    return res.rows;
  } catch (error) {
    console.error("DB Error (getTasksForDailyReminder): Fallo al obtener tareas para recordatorio.", error);
    return [];
  }
}

export async function clearAllTasks(userId) {
  // TODO: Implementar verificación de permisos si es necesario
  // const ADMIN_IDS = [parseInt(process.env.ADMIN_USER_ID1 || '0')];
  // if (!ADMIN_IDS.includes(userId) || ADMIN_IDS[0] === 0) {
  //    return { success: false, message: "❌ No tienes permiso para borrar todas las tareas." };
  // }
  try {
    // Obtener el conteo antes de borrar para el mensaje
    const countRes = await query('SELECT COUNT(*) as task_count FROM tasks');
    const numberOfTasksInitially = parseInt(countRes.rows[0].task_count, 10);

    const deleteRes = await query('DELETE FROM tasks'); // ¡Borra TODAS las tareas!
    const numberOfTasksDeleted = deleteRes.rowCount; // rowCount es más fiable para DELETE

    if (numberOfTasksInitially > 0) { // O usar numberOfTasksDeleted > 0 si el conteo previo es complejo
      return { success: true, message: `🗑️ ¡Todas las ${numberOfTasksInitially} tareas han sido eliminadas! Lista limpia. ✨` };
    } else {
      return { success: true, message: "🧹 No había tareas para eliminar. ¡Todo estaba limpio!" };
    }
  } catch (error) {
    console.error("DB Error (clearAllTasks): Fallo al borrar todas las tareas.", error);
    return { success: false, message: "⚠️ Ocurrió un error al intentar borrar las tareas." };
  }
}


// --- Funciones para Pinned Work ---
const PINNED_WORK_KEY = 'default_bot';

export async function setPinnedWork(chatId, messageId, documentObject, userId) {
  // El objeto 'documentObject' es el que viene de Telegram, ej: message.reply_to_message.document
  if (!documentObject || !documentObject.file_id) {
    return { success: false, message: `⚠️ El mensaje respondido no parece contener un documento válido. Asegúrate de responder directamente al mensaje con el archivo .doc o .docx.` };
  }
  
  const pinnedWorkData = {
    bot_instance_key: PINNED_WORK_KEY, // Asegurarse de que se incluya para la query
    chat_id: chatId,
    message_id: messageId,
    file_id: documentObject.file_id,
    file_name: documentObject.file_name || "documento_fijado.doc",
    caption: documentObject.caption || null,
    pinned_by_user_id: userId,
    pinned_at: new Date().toISOString()
  };

  try {
    await query(
      `UPDATE pinned_work 
       SET chat_id = $1, message_id = $2, file_id = $3, file_name = $4, caption = $5, pinned_by_user_id = $6, pinned_at = $7
       WHERE bot_instance_key = $8`,
      [pinnedWorkData.chat_id, pinnedWorkData.message_id, pinnedWorkData.file_id, pinnedWorkData.file_name, pinnedWorkData.caption, pinnedWorkData.pinned_by_user_id, pinnedWorkData.pinned_at, pinnedWorkData.bot_instance_key]
    );
    // console.log("DB Success (setPinnedWork): Trabajo Fijado actualizado en DB:", pinnedWorkData.file_name);
    return { success: true, message: `📄 ¡Documento "${escapeHTML(pinnedWorkData.file_name)}" fijado como el trabajo actual!` };
  } catch (error) {
    console.error("DB Error (setPinnedWork): Fallo al fijar trabajo.", error);
    return { success: false, message: "⚠️ Ocurrió un error al fijar el trabajo." };
  }
}

export async function getPinnedWork() {
  try {
    const res = await query('SELECT chat_id, message_id, file_id, file_name, caption, pinned_by_user_id, pinned_at FROM pinned_work WHERE bot_instance_key = $1', [PINNED_WORK_KEY]);
    if (res.rows.length > 0 && res.rows[0].file_id) {
      const dbRow = res.rows[0];
      // Mapear nombres de columna de DB a nombres de propiedad esperados si son diferentes
      const work = {
          chatId: dbRow.chat_id,
          messageId: dbRow.message_id,
          fileId: dbRow.file_id,
          fileName: dbRow.file_name,
          caption: dbRow.caption,
          pinnedBy: dbRow.pinned_by_user_id, // Asegúrate que el nombre de la columna sea pinned_by_user_id
          pinnedAt: dbRow.pinned_at
      };
      return { success: true, work: work };
    }
    return { success: false, message: `ℹ️ No hay ningún documento de trabajo fijado actualmente. Responde a un mensaje con un documento .doc/.docx usando ${code("/trabajo")} para fijarlo.` };
  } catch (error) {
    console.error("DB Error (getPinnedWork): Fallo al obtener trabajo fijado.", error);
    return { success: false, message: "⚠️ Ocurrió un error al obtener el trabajo fijado." };
  }
}

export async function clearPinnedWork(userId) {
  // TODO: Permisos
  try {
    const currentWorkResult = await getPinnedWork(); // Reutilizar getPinnedWork para saber si hay algo que borrar
    if (currentWorkResult.success && currentWorkResult.work) {
        const oldWorkName = currentWorkResult.work.fileName;
        await query(
            `UPDATE pinned_work 
             SET chat_id = NULL, message_id = NULL, file_id = NULL, file_name = NULL, caption = NULL, pinned_by_user_id = NULL, pinned_at = NULL
             WHERE bot_instance_key = $1`,
            [PINNED_WORK_KEY]
        );
        return { success: true, message: `🗑️ El trabajo "${escapeHTML(oldWorkName)}" ha sido desfijado.` };
    }
    return { success: true, message: "🤷 No había ningún trabajo fijado para desfijar." };
  } catch (error) {
    console.error("DB Error (clearPinnedWork): Fallo al desfijar trabajo.", error);
    return { success: false, message: "⚠️ Ocurrió un error al desfijar el trabajo." };
  }
}