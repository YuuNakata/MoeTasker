# app/handlers/common.py
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from aiogram.utils.markdown import hbold, hitalic, hcode, hlink # Helpers de Aiogram para Markdown
from app.services import moe_handler

# Crear un Router para estos handlers
router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    sender_name = message.from_user.first_name if message.from_user else "estimado usuario"
    fun_phrase_data = moe_handler.get_random_fun_phrase()
    
    # Usar helpers de Aiogram para formateo es más seguro
    text = (
        f"¡Hola {hbold(sender_name)}! Soy el bot de gestión de proyectos. {fun_phrase_data['kaomoji']}\n"
        f"Usa {hcode('/asignar <Tarea 1>, <Tarea 2>, ...')} para distribuir trabajo.\n"
        f"Usa {hcode('/tareas')} para ver las tareas pendientes.\n"
        f"Usa {hcode('/completar <id_tarea>')} o {hcode('/completar_<id_tarea>')} para marcar una tarea como hecha.\n"
        f"Usa {hcode('/frase')} para una dosis de ánimo. {fun_phrase_data['phrase']}"
    )
    await message.answer(text, parse_mode="HTML") # Aiogram recomienda HTML para mejor compatibilidad

@router.message(Command(commands=["frase", "relax"]))
async def cmd_fun_phrase(message: Message):
    data = moe_handler.get_random_fun_phrase()
    await message.answer(f"{data['phrase']} {data['kaomoji']}", parse_mode="HTML")

# Manejo de texto general para respuestas moe
# Este handler debe ir después de los Command handlers para no interceptar comandos
@router.message(F.text & ~F.text.startswith('/')) # Solo texto, no comandos
async def handle_text_for_moe(message: Message):
    if message.text:
        moe_response = moe_handler.get_moe_response(message.text)
        if moe_response:
            # Usar el escapador de MarkdownV2 de Aiogram si parse_mode es MarkdownV2
            # from aiogram.utils.markdown import escape_md
            # await message.answer(escape_md(moe_response), parse_mode="MarkdownV2")
            # O si moe_response ya está escapado y usamos HTML:
            await message.answer(moe_response, parse_mode="HTML") # Asumiendo que moe_response ya está formateado o es seguro para HTML