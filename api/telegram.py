# api/telegram.py
import asyncio
import json
import os
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse

# Cargar .env
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
dotenv_path = os.path.join(project_root, '.env')
if os.path.exists(dotenv_path): load_dotenv(dotenv_path)

from app.bot_instance import bot, dp # bot y dispatcher de Aiogram
from aiogram import types
from aiogram.webhook.aiohttp_server import SimpleRequestHandler # Para manejar requests

# --- Configuración del Webhook (Idealmente se hace una vez) ---
WEBHOOK_HOST = os.getenv("WEBHOOK_BASE_URL")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/api/telegram") # FastAPI servirá en este path relativo
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Inicializar FastAPI app
# Vercel sirve la app FastAPI desde este archivo si `vercel.json` lo dirige aquí.
# El "rewrites" del artículo es para que todo vaya a un `index.py` que define `app = FastAPI()`.
# Si nuestro archivo se llama `telegram.py`, Vercel podría buscar `app` aquí.
app = FastAPI(
    title="Telegram Bot Webhook Handler",
    description="Handles Telegram updates via webhook using FastAPI and Aiogram.",
)

# Guardar el estado del webhook (problemático en serverless, mejor un script de setup)
# _webhook_is_set = False

@app.on_event("startup")
async def on_startup():
    # global _webhook_is_set
    # if not _webhook_is_set and (os.getenv('VERCEL_ENV') == 'production' or WEBHOOK_HOST):
    # Este es un buen lugar para configurar el webhook SIEMPRE Y CUANDO
    # el startup de FastAPI se ejecute de forma fiable una vez por instancia "caliente"
    # o si usas un script de deploy para llamar a un endpoint de setup.
    # Para Vercel, es más seguro configurar el webhook externamente o con un endpoint GET.
    if os.getenv('VERCEL_ENV') == 'production' or WEBHOOK_HOST:
        print(f"FastAPI Startup: Intentando configurar webhook en: {WEBHOOK_URL}")
        try:
            await bot.set_webhook(
                url=WEBHOOK_URL,
                allowed_updates=dp.resolve_used_update_types(),
                # secret_token=os.getenv("TELEGRAM_WEBHOOK_SECRET") # Opcional
            )
            # _webhook_is_set = True
            print(f"FastAPI Startup: Webhook configurado en {WEBHOOK_URL}")
        except Exception as e:
            print(f"FastAPI Startup: Error al configurar webhook: {e}")
    else:
        print("FastAPI Startup: Saltando configuración de webhook (no en Vercel o WEBHOOK_HOST no definido).")

@app.on_event("shutdown")
async def on_shutdown():
    # Opcional: Limpiar recursos del bot, como cerrar la sesión
    # No es estrictamente necesario para webhooks si cada request es independiente.
    print("FastAPI Shutdown: Limpiando sesión del bot...")
    await bot.session.close()
    print("FastAPI Shutdown: Sesión del bot cerrada.")


# El endpoint que Telegram llamará (debe coincidir con WEBHOOK_PATH y `vercel.json` routes)
@app.post(WEBHOOK_PATH) # ej: si WEBHOOK_PATH es /api/telegram, FastAPI lo toma desde la raíz de la app
async def telegram_webhook_endpoint(request: Request):
    """
    Recibe las actualizaciones de Telegram.
    FastAPI parseará el JSON automáticamente.
    """
    try:
        # Obtener el cuerpo como dict
        update_data = await request.json()
        # print(f"Datos recibidos en webhook: {update_data}")

        # Crear objeto Update de Aiogram y procesarlo
        # El dispatcher de Aiogram puede manejar esto
        # SimpleRequestHandler es para aiohttp, necesitamos el equivalente para FastAPI o manual
        
        # Para Aiogram 3.x, y FastAPI, puedes pasar el bot y el dispatcher
        # y usar `feed_webhook_update` si manejas la respuesta HTTP correctamente.
        # O, como antes, construir el objeto Update y usar feed_update.

        update = types.Update(**update_data)
        
        # `feed_webhook_update` está diseñado para cuando tienes control total del servidor HTTP.
        # Para FastAPI, pasar el update y que el dispatcher lo maneje internamente es más simple
        # y luego FastAPI devuelve el 200 OK.
        # El resultado de `feed_webhook_update` es una instancia de `web.Response` (aiohttp)
        # o similar, que FastAPI no maneja directamente.
        
        # Opción más simple:
        await dp.feed_update(bot=bot, update=update)
        
        # Telegram espera un 200 OK, puede ser vacío o con ciertos métodos.
        # FastAPI por defecto devuelve 200 OK si no hay error y no se especifica otra cosa.
        return JSONResponse(content={}, status_code=status.HTTP_200_OK)

    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")
    except Exception as e:
        print(f"Error procesando el webhook: {e}")
        import traceback
        traceback.print_exc()
        # No devuelvas el detalle del error a Telegram por seguridad, solo un 500.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

# Opcional: Un endpoint GET para verificar que la app está viva o para configurar el webhook
@app.get(WEBHOOK_PATH + "/setup") # ej: /api/telegram/setup
async def setup_webhook_endpoint():
    if os.getenv('VERCEL_ENV') == 'production' or WEBHOOK_HOST:
        try:
            await bot.set_webhook(url=WEBHOOK_URL, allowed_updates=dp.resolve_used_update_types())
            return {"status": "success", "message": f"Webhook set to {WEBHOOK_URL}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "skipped", "message": "Webhook setup skipped (not in prod or no webhook host)."}

@app.get("/") # Un endpoint raíz para pruebas, como en el artículo
async def root_index():
    return {"message": "Hello from FastAPI Bot App! Webhook is at " + WEBHOOK_PATH}

# Si este archivo es `api/telegram.py`, Vercel podría buscar una variable `app` de FastAPI.
# El nombre del archivo en `api/` y la variable `app` deben ser consistentes o
# usar `vercel.json` para mapear correctamente.
# Si tu `vercel.json` en `routes` dice:
# { "src": "/api/telegram", "dest": "/api/telegram.py" }
# Vercel ejecutará este archivo. Si contiene `app = FastAPI()`, servirá esa app.