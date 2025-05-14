# app/handlers/tasks.py
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, Dice
from aiogram.utils.markdown import hlink, hcode # Aiogram helpers
import asyncio # Para la pausa del dado

from app.services import task_manager

router = Router()

@router.message(Command(commands=["asignar"]))
async def cmd_assign_tasks(message: Message, command: CommandObject | None = None): # CommandObject para argumentos
    if not command or not command.args:
        await message.answer(
            "Por favor, proporciona las tareas después del comando, separadas por comas.\n"
            f"Ejemplo: {hcode('/asignar Hacer UI, Implementar API')}",
            parse_mode="HTML"
        )
        return

    task_descriptions = [desc.strip() for desc in command.args.split(',') if desc.strip()]
    if not task_descriptions:
        await message.answer("Debes proporcionar al menos una descripción de tarea válida.")
        return

    initial_msg = await message.answer("🎲 Iniciando asignación de tareas...")
    dice_msg: Message = await message.answer_dice(emoji="🎲") # Enviar dado

    await asyncio.sleep(3.5) # Esperar la animación del dado y simular procesamiento

    # Editar mensaje inicial (opcional)
    # await initial_msg.edit_text("⚙️ Procesando asignaciones...")

    response_text, _ = await task_manager.assign_tasks(message.chat.id, task_descriptions)
    
    try: # Intentar borrar mensajes intermedios
        await initial_msg.delete()
        if dice_msg: # El dado es un mensaje separado
            await dice_msg.delete()
    except Exception as e:
        print(f"No se pudieron borrar los mensajes intermedios: {e}")

    await message.answer(response_text, parse_mode="HTML") # Usar HTML como recomienda Aiogram

@router.message(Command(commands=["tareas"]))
async def cmd_list_tasks(message: Message):
    summary = await task_manager.get_pending_tasks_summary()
    await message.answer(summary, parse_mode="HTML")

# Para /completar ID y /completar_ID
# Aiogram v3 usa F.magic para filtros más complejos o puedes usar regex
@router.message(Command(re.compile(r"completar_(\w+)|completar\s+(\w+)")))
async def cmd_complete_task(message: Message, regexp_command: re.Match[str] | None = None):
    task_id = ""
    if regexp_command:
        # regexp_command.group(1) es para completar_ID
        # regexp_command.group(2) es para completar ID
        task_id = regexp_command.group(1) or regexp_command.group(2)
    
    if not task_id:
        await message.answer(f"Por favor, proporciona el ID de la tarea. Ejemplo: {hcode('/completar_abcdef12')}", parse_mode="HTML")
        return

    sender_id = message.from_user.id if message.from_user else 0
    response = await task_manager.complete_task(task_id, sender_id)
    await message.answer(response, parse_mode="HTML")

# Para importar CommandObject
from aiogram.filters.command import CommandObject
import re # para Command(re.compile(...))