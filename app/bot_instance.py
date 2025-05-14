# app/bot_instance.py
import os
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from dotenv import load_dotenv

# Importar routers de los handlers
from app.handlers import common, tasks

load_dotenv() # Cargar variables de .env

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("No se encontró TELEGRAM_BOT_TOKEN en las variables de entorno.")

# Configuración del Bot y Dispatcher
# Usar HTML como parse_mode por defecto es una buena práctica con Aiogram
bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# Registrar routers
dp.include_router(common.router)
dp.include_router(tasks.router)
# El router de texto general (moe) debe ir después de los comandos
# para que no los intercepte si común.router ya lo tiene.
# Si moe_handler está en common.router y es el último handler allí, está bien.

# Para DefaultBotProperties
from aiogram.client.default import DefaultBotProperties