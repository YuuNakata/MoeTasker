# app/utils/scheduler_helpers.py
import os
from aiogram import Bot # Solo necesitas la instancia de Bot para enviar mensajes
from app.services import task_manager, moe_handler
from app.services.task_manager import Task # Importar el tipo Task

# Esta función será llamada por un cron job (ej: Vercel Cron)
async def trigger_daily_reminders(bot_instance: Bot):
    print(f"[{datetime.utcnow().isoformat()}] Ejecutando recordatorios diarios (scheduler)...")
    pending_tasks: List[Task] = await task_manager.get_tasks_for_daily_reminder()

    if not pending_tasks:
        print("Scheduler: No hay tareas pendientes para recordar.")
        return

    # ... (lógica de envío similar a la de Telegraf, adaptada a Aiogram)
    for task in pending_tasks:
        user_mention = f"<a href='tg://user?id={task['assigned_to_id']}'>{task['assigned_to_name']}</a>"
        complete_command = f"/completar_{task['id']}"
        message_text = (
            f"📢 <b>Recordatorio de Tarea Pendiente</b>\n\n"
            f"🔔 Tarea: {task['description']}\n"
            f"👤 Asignada a: {user_mention}\n"
            f"🆔 ID Tarea: <code>{task['id']}</code>\n\n"
            f"¡No olvides completarla! Usa <code>{complete_command}</code> cuando termines."
        )
        try:
            if task['chat_id']:
                await bot_instance.send_message(
                    chat_id=task['chat_id'],
                    text=message_text,
                    parse_mode="HTML" # Usar HTML consistente
                )
                print(f"Scheduler: Recordatorio enviado para tarea {task['id']} a chat {task['chat_id']}")
                # Pequeña pausa para evitar rate limits si hay muchos mensajes
                await asyncio.sleep(0.3)
        except Exception as e:
            print(f"Scheduler: Error al enviar recordatorio para tarea {task['id']}: {e}")

async def trigger_random_fun_message(bot_instance: Bot):
    target_group_id_str = os.getenv("TELEGRAM_TARGET_GROUP_ID")
    if not target_group_id_str:
        print("Scheduler: TELEGRAM_TARGET_GROUP_ID no configurado. No se enviará mensaje aleatorio.")
        return
    
    target_group_id = int(target_group_id_str)
    print(f"[{datetime.utcnow().isoformat()}] Enviando mensaje aleatorio (scheduler)...")
    try:
        message_to_send = moe_handler.get_random_phrase_for_scheduler()
        await bot_instance.send_message(
            chat_id=target_group_id,
            text=message_to_send,
            parse_mode="HTML" # Asume que la frase ya está formateada o es segura para HTML
        )
        print(f"Scheduler: Mensaje aleatorio enviado al grupo {target_group_id}")
    except Exception as e:
        print(f"Scheduler: Error al enviar mensaje aleatorio al grupo: {e}")

import asyncio # para asyncio.sleep
from datetime import datetime # para logging
from typing import List # para type hint