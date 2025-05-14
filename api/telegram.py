# api/telegram.py
import asyncio
import json
import os
from dotenv import load_dotenv

# Cargar .env ANTES de importar módulos de la app que puedan usar os.getenv al cargar
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
dotenv_path = os.path.join(project_root, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    print(f"Advertencia: Archivo .env no encontrado en {dotenv_path}")


# Ahora importa la instancia del bot y dispatcher
from app.bot_instance import bot, dp # bot y dispatcher
from aiogram import types

# --- Configuración del Webhook (Idealmente se hace una vez) ---
WEBHOOK_HOST = os.getenv("WEBHOOK_BASE_URL") # ej: https://your-app.vercel.app
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/api/telegram") # ej: /api/telegram
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Variables para asegurar que el webhook se configure solo una vez por "vida" del worker
# Esto es complicado en serverless, es mejor un script de deploy o un endpoint GET de setup.
# _webhook_set = False

async def set_webhook_on_startup():
    # global _webhook_set
    # if _webhook_set:
    #     return
    if os.getenv('VERCEL_ENV') == 'production' or WEBHOOK_HOST: # Solo si estamos en Vercel o WEBHOOK_HOST está definido
        print(f"Intentando configurar webhook en: {WEBHOOK_URL}")
        try:
            await bot.set_webhook(
                url=WEBHOOK_URL,
                allowed_updates=dp.resolve_used_update_types() # Solo los updates que el dispatcher usa
            )
            # _webhook_set = True
            print("Webhook configurado exitosamente.")
        except Exception as e:
            print(f"Error al configurar webhook: {e}")
    else:
        print("Saltando configuración de webhook (no en Vercel o WEBHOOK_HOST no definido).")

# --- Vercel Handler ---
# Vercel espera una función llamada 'handler' o un framework compatible.
# Para Aiogram, necesitamos procesar la request.
# Para un entorno serverless como Vercel, necesitas llamar a `Dispatcher.feed_webhook_update`
# y luego podrías necesitar manejar el ciclo de vida del bot de forma diferente.

# Este es un ejemplo de cómo se podría manejar la request de Vercel
# La documentación de Aiogram para despliegue en serverless es importante.

# Una forma común es tener un script de inicio que registre el webhook y luego
# el handler solo procese las actualizaciones.

# El `handler` que Vercel llamará:
async def vercel_handler(event, context): # Vercel puede usar este formato para funciones Python
    """
    Handler para Vercel. `event` contiene el payload del webhook de Telegram.
    `context` es el contexto de la lambda de AWS (Vercel usa AWS Lambda bajo el capó).
    """
    # print(f"Evento recibido por Vercel: {event}")
    # print(f"Contexto de Vercel: {context}")

    # Configurar webhook al inicio de la primera invocación (si no se hizo antes)
    # Podría ser mejor hacerlo en un paso de "post-deploy" o un endpoint de setup
    # await set_webhook_on_startup() # Comentado para evitar múltiples llamadas si el worker se reutiliza

    try:
        # Aiogram 3.x: El dispatcher maneja la actualización directamente.
        # El 'event' de Vercel (si viene de API Gateway) podría tener el body en `event['body']`
        # y podría ser un string JSON que necesita ser parseado.
        
        telegram_update_data = {}
        if isinstance(event.get('body'), str):
            try:
                telegram_update_data = json.loads(event['body'])
            except json.JSONDecodeError:
                print("Error: No se pudo decodificar el cuerpo JSON de la solicitud.")
                return {'statusCode': 400, 'body': 'Bad Request: Invalid JSON'}
        elif isinstance(event.get('body'), dict): # Si Vercel ya lo parseó
             telegram_update_data = event['body']
        else:
            print(f"Advertencia: El cuerpo de la solicitud no es un string JSON ni un dict. Tipo: {type(event.get('body'))}")
            # Si es una prueba directa desde Telegram, puede que no tenga 'body' y el evento sea el update
            if 'update_id' in event: # Asumir que 'event' es el update directo
                 telegram_update_data = event
            else:
                 return {'statusCode': 400, 'body': 'Bad Request: Cuerpo no reconocido'}


        if not telegram_update_data:
            print("Error: No hay datos de actualización de Telegram para procesar.")
            return {'statusCode': 400, 'body': 'Bad Request: No update data'}

        # Crear objeto Update y procesarlo
        update = types.Update(**telegram_update_data)
        # print(f"Update de Telegram procesado: {update}")

        # Procesar el update con el dispatcher
        # dp.feed_update tomará el objeto Update directamente
        # Para un webhook, se usa feed_webhook_update para manejar la respuesta a Telegram también
        # El resultado de feed_webhook_update debe ser devuelto como respuesta HTTP.
        # Aiogram 3.x simplifica esto.
        
        # El método recomendado para serverless es que el dispatcher devuelva
        # la respuesta que se debe enviar de vuelta a Telegram.
        # await dp.feed_webhook_update(bot, update) # Esto es para Aiogram < 3.1
        # En Aiogram 3.1+, el dispatcher puede manejar directamente requests HTTP si se configura como servidor web.
        # Para funciones serverless puras, el enfoque es más manual o usando helpers de la librería.

        # La forma más directa con Aiogram 3.x para un webhook es:
        # await Dispatcher. इसको handle_webhook_update(update, bot=bot, **data_for_middlewares)
        # Pero esto es si tienes el control del servidor HTTP.
        # Con Vercel, te dan la request.

        # Aquí simplemente pasamos el update al dispatcher.
        # La respuesta a Telegram (un 200 OK vacío) es manejada por Vercel si la función retorna exitosamente.
        await dp.feed_update(bot=bot, update=update)
        
        return {
            'statusCode': 200,
            'body': '' # Telegram espera un 200 OK vacío o un JSON con ciertos métodos
        }

    except Exception as e:
        print(f"Error al procesar el update de Telegram: {e}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500, # Error interno del servidor
            'body': 'Internal Server Error'
        }

# --- Script de configuración de Webhook (para ejecutar una vez) ---
async def main_set_webhook():
    """Función para configurar el webhook manualmente si es necesario."""
    await set_webhook_on_startup()
    await bot.session.close() # Cerrar la sesión del bot después de configurar

if __name__ == "__main__":
    # Este bloque se puede usar para configurar el webhook manualmente desde la línea de comandos
    # (ej: python -m api.telegram set_webhook)
    # O para pruebas locales con polling (requeriría más código aquí).
    # if len(sys.argv) > 1 and sys.argv[1] == "set_webhook":
    #    asyncio.run(main_set_webhook())
    #    print("Operación de webhook completada.")
    # else:
    #    print("Para configurar el webhook, ejecuta: python -m api.telegram set_webhook")
    #    print("Este archivo es principalmente para el handler de Vercel.")
    pass

# Renombrar `vercel_handler` a `handler` para que Vercel lo recoja por defecto si el archivo se llama telegram.py
handler = vercel_handler