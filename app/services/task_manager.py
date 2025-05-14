# app/services/task_manager.py
import os
import uuid
from datetime import datetime, timedelta
import random
from typing import List, Dict, Tuple, TypedDict

# --- Tipos ---
class Task(TypedDict):
    id: str
    description: str
    assigned_to_name: str
    assigned_to_id: int
    assigned_at: str  # ISO string
    due_by: str | None # ISO string
    completed: bool
    completed_at: str | None # ISO string
    chat_id: int

TeamMemberConfig = Dict[str, int]

# --- Simulación de Base de Datos ---
# ¡¡¡REEMPLAZAR CON UNA BASE DE DATOS REAL EN PRODUCCIÓN!!!
_tasks_db: List[Task] = []
# ---------------------------------

_TEAM_MEMBERS: TeamMemberConfig = {
    'Raydel': int(os.environ.get('USER_ID_RAYDEL', '0')),
    'Claudia': int(os.environ.get('USER_ID_CLAUDIA', '0')),
    'Grettel': int(os.environ.get('USER_ID_GRETTEL', '0')),
    'Ernesto': int(os.environ.get('USER_ID_ERNESTO', '0')),
    'Javier': int(os.environ.get('USER_ID_JAVIER', '0')),
}
_active_team_member_names = [name for name, uid in _TEAM_MEMBERS.items() if uid != 0]

def _shuffle_array(array: list) -> list:
    new_array = array[:]
    for i in range(len(new_array) - 1, 0, -1):
        j = random.randint(0, i)
        new_array[i], new_array[j] = new_array[j], new_array[i]
    return new_array

# ----- Funciones CRUD para tareas (simuladas) -----
def _find_task_by_id(task_id: str) -> Task | None:
    for task in _tasks_db:
        if task['id'] == task_id:
            return task
    return None

def _get_pending_tasks_from_db() -> List[Task]:
    return [task for task in _tasks_db if not task['completed']]

def _save_task_to_db(task: Task) -> None:
    # En una DB real: await db.task.create o .update
    # Para simulación, si existe actualiza, si no, añade
    existing_task_index = -1
    for i, t in enumerate(_tasks_db):
        if t['id'] == task['id']:
            existing_task_index = i
            break
    if existing_task_index != -1:
        _tasks_db[existing_task_index] = task
    else:
        _tasks_db.append(task)
    # print("Tasks DB (simulada):", _tasks_db) # Para depuración
# -------------------------------------------------

async def assign_tasks(
    chat_id: int,
    task_descriptions: List[str]
) -> Tuple[str, List[Task]]:
    if not _active_team_member_names:
        return "⚠️ No hay miembros del equipo configurados correctamente.", []
    if not task_descriptions:
        return "Por favor, proporciona descripciones para las tareas.", []

    num_tasks = len(task_descriptions)
    num_members = len(_active_team_member_names)
    newly_assigned_tasks: List[Task] = []
    assignments_text = ""

    assignment_pool: List[str] = []
    base_tasks_per_member = num_tasks // num_members
    remaining_tasks = num_tasks % num_members

    for member_name in _active_team_member_names:
        for _ in range(base_tasks_per_member):
            assignment_pool.append(member_name)

    members_for_extra_tasks = _shuffle_array(_active_team_member_names[:])
    for i in range(remaining_tasks):
        assignment_pool.append(members_for_extra_tasks[i])

    final_shuffled_assignment_pool = _shuffle_array(assignment_pool)

    for i, desc in enumerate(task_descriptions):
        member_name = final_shuffled_assignment_pool[i]
        member_id = _TEAM_MEMBERS[member_name]

        new_task: Task = {
            'id': str(uuid.uuid4())[:8],
            'description': desc.strip(),
            'assigned_to_name': member_name,
            'assigned_to_id': member_id,
            'assigned_at': datetime.utcnow().isoformat() + "Z",
            'due_by': (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z",
            'completed': False,
            'completed_at': None,
            'chat_id': chat_id,
        }
        _save_task_to_db(new_task)
        newly_assigned_tasks.append(new_task)
        # Para MarkdownV2, los enlaces de mención son [texto](tg://user?id=ID)
        assignments_text += f"  🔹 {desc.strip()} ➡️ [{member_name}](tg://user?id={member_id})\n"

    response_message = f"✅ *Tareas Asignadas Equitativa y Aleatoriamente:*\n\n{assignments_text}\nRecuerden marcar las tareas como completadas usando `/completar <id_tarea>`."
    return response_message, newly_assigned_tasks

async def complete_task(task_id: str, completing_user_id: int) -> str:
    task = _find_task_by_id(task_id)
    if not task:
        return f"❌ No se encontró la tarea con ID `{task_id}`."
    if task['completed']:
        return f"🤔 La tarea '{task['description']}' (`{task_id}`) ya estaba completada."

    # ADMIN_ID = int(os.environ.get('ADMIN_USER_ID', '0'))
    if task['assigned_to_id'] != completing_user_id: # and completing_user_id != ADMIN_ID:
         return f"❌ Solo [{task['assigned_to_name']}](tg://user?id={task['assigned_to_id']}) o un admin puede marcar esta tarea."

    task['completed'] = True
    task['completed_at'] = datetime.utcnow().isoformat() + "Z"
    _save_task_to_db(task)
    return f"✅ ¡Bien hecho! Tarea '{task['description']}' (`{task_id}`) marcada como completada por {task['assigned_to_name']}."

async def get_pending_tasks_summary() -> str:
    pending = _get_pending_tasks_from_db()
    if not pending:
        return "🎉 ¡No hay tareas pendientes! ¡Buen trabajo equipo!"

    summary = "📋 *Resumen de Tareas Pendientes:*\n"
    for task in pending:
        summary += (
            f"\n🔹 `{task['id']}`: {task['description']} "
            f"(Asignada a: [{task['assigned_to_name']}](tg://user?id={task['assigned_to_id']}))"
            f" - Toca para marcarla: `/completar_{task['id']}`"
        )
    return summary

async def get_tasks_for_daily_reminder() -> List[Task]:
    return _get_pending_tasks_from_db()