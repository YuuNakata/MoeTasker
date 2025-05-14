// src/services/taskManager.ts
import { Task, TeamMemberConfig } from '../types';
import { v4 as uuidv4 } from 'uuid'; // Necesitarás instalar uuid: npm install uuid @types/uuid

// --- Simulación de Base de Datos ---
// ¡¡¡REEMPLAZAR CON UNA BASE DE DATOS REAL EN PRODUCCIÓN!!!
// (ej: Prisma con PostgreSQL/Supabase, MongoDB, Firebase, etc.)
let tasksDB: Task[] = [];
// ---------------------------------

// Cargar configuración del equipo desde variables de entorno
const TEAM_MEMBERS: TeamMemberConfig = {
  'Raydel': parseInt(process.env.USER_ID_RAYDEL || '0'),
  'Claudia': parseInt(process.env.USER_ID_CLAUDIA || '0'),
  'Grettel': parseInt(process.env.USER_ID_GRETTEL || '0'),
  'Ernesto': parseInt(process.env.USER_ID_ERNESTO || '0'),
  'Javier': parseInt(process.env.USER_ID_JAVIER || '0'),
};
// Filtrar miembros con ID 0 (no configurados)
const activeTeamMemberNames = Object.keys(TEAM_MEMBERS).filter(name => TEAM_MEMBERS[name] !== 0);

function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array]; // Crear una copia para no modificar el original
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Intercambiar elementos
    }
    return newArray;
  }


// ----- Funciones CRUD para tareas (simuladas) -----
// En una implementación real, estas serían async y harían queries a la DB
function findTaskById(id: string): Task | undefined {
  return tasksDB.find(task => task.id === id);
}

function getPendingTasksFromDB(): Task[] {
  return tasksDB.filter(task => !task.completed);
}

function saveTaskToDB(task: Task): void {
  const index = tasksDB.findIndex(t => t.id === task.id);
  if (index > -1) {
    tasksDB[index] = task; // Update
  } else {
    tasksDB.push(task); // Create
  }
  // En una DB real: await db.task.create o .update
  console.log("Tasks DB (simulada):", tasksDB); // Para depuración
}
// -------------------------------------------------

export async function assignTasks(
    chatId: number,
    taskDescriptions: string[]
  ): Promise<{ message: string; assignedTasksData: Task[] }> {
    if (!activeTeamMemberNames.length) {
      return { message: "⚠️ No hay miembros del equipo configurados correctamente.", assignedTasksData: [] };
    }
    if (!taskDescriptions.length) {
      return { message: "Por favor, proporciona descripciones para las tareas.", assignedTasksData: [] };
    }
  
    const numTasks = taskDescriptions.length;
    const numMembers = activeTeamMemberNames.length;
  
    const newlyAssignedTasks: Task[] = [];
    let assignmentsText = "";
  
    // 1. Crear el pool de asignaciones para distribución equitativa
    let assignmentPool: string[] = [];
  
    // Tareas base para cada miembro
    const baseTasksPerMember = Math.floor(numTasks / numMembers);
    for (let i = 0; i < numMembers; i++) {
      for (let j = 0; j < baseTasksPerMember; j++) {
        assignmentPool.push(activeTeamMemberNames[i]);
      }
    }
  
    // Tareas extra a distribuir
    let remainingTasks = numTasks % numMembers;
    // Seleccionar aleatoriamente miembros para las tareas extra sin repetición
    const membersForExtraTasks = shuffleArray([...activeTeamMemberNames]); // Copia barajada
  
    for (let i = 0; i < remainingTasks; i++) {
      assignmentPool.push(membersForExtraTasks[i]);
    }
  
    
    // 2. Barajar el pool de asignaciones final
    // Ahora assignmentPool tiene `numTasks` elementos, con una distribución equitativa
    // y los que tienen tareas extra están distribuidos aleatoriamente.
    const finalShuffledAssignmentPool = shuffleArray(assignmentPool);
  
    // 3. Asignar tareas
    taskDescriptions.forEach((desc, index) => {
      const memberName = finalShuffledAssignmentPool[index]; // Tomar el siguiente del pool barajado
      const memberId = TEAM_MEMBERS[memberName];
  
      const newTask: Task = {
        id: uuidv4().substring(0, 8),
        description: desc.trim(),
        assigned_to_name: memberName,
        assigned_to_id: memberId,
        assigned_at: new Date().toISOString(),
        completed: false,
        chat_id: chatId,
      };
      saveTaskToDB(newTask);
      newlyAssignedTasks.push(newTask);
      assignmentsText += `  🔹 ${desc.trim()} ➡️ [${memberName}](tg://user?id=${memberId})\n`;
    });
  
    const responseMessage = `✅ **Tareas Asignadas Equitativa y Aleatoriamente:**\n\n${assignmentsText}\nRecuerden marcar las tareas como completadas usando \`/completar <id_tarea>\`.`;
    return { message: responseMessage, assignedTasksData: newlyAssignedTasks };
  }
  

export async function completeTask(taskId: string, completingUserId: number): Promise<string> {
  const task = findTaskById(taskId);

  if (!task) {
    return `❌ No se encontró la tarea con ID \`${taskId}\`.`;
  }
  if (task.completed) {
    return `🤔 La tarea '${task.description}' (\`${taskId}\`) ya estaba completada.`;
  }

  // Verificación de quién completa (puedes añadir un ADMIN_ID si quieres)
  // const ADMIN_ID = parseInt(process.env.ADMIN_USER_ID || '0');
  if (task.assigned_to_id !== completingUserId /* && completingUserId !== ADMIN_ID */) {
    return `❌ Solo [${task.assigned_to_name}](tg://user?id=${task.assigned_to_id}) o un admin puede marcar esta tarea como completada.`;
  }

  task.completed = true;
  task.completed_at = new Date().toISOString();
  saveTaskToDB(task); // Actualizar en nuestra "DB"

  return `✅ ¡Bien hecho! Tarea '${task.description}' (\`${taskId}\`) marcada como completada por ${task.assigned_to_name}.`;
}

export async function getPendingTasksSummary(): Promise<string> {
  const pending = getPendingTasksFromDB();

  if (!pending.length) {
    return "🎉 ¡No hay tareas pendientes! ¡Buen trabajo equipo!";
  }

  let summary = "📋 **Resumen de Tareas Pendientes:**\n";
  pending.forEach(task => {
    summary += `\n🔹 \`${task.id}\`: ${task.description} (Asignada a: [${task.assigned_to_name}](tg://user?id=${task.assigned_to_id})) - Toca para marcarla: \`/completar_${task.id}\``;
  });
  return summary;
}

// Funciones para el scheduler
export async function getTasksForDailyReminder(): Promise<Task[]> {
    return getPendingTasksFromDB();
}