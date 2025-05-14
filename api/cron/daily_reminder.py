# api/cron/daily_reminder.py
import asyncio
import os
from dotenv import load_dotenv

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
dotenv_path = os.path.join(project_root, '.env')
if os.path.exists(dotenv_path): load_dotenv(dotenv_path)

from app.bot_instance import bot # Importa solo la instancia de Bot
from app.utils.scheduler_helpers import trigger_daily_reminders

async def _main():
    print("Cron Job: Iniciando trigger_daily_reminders...")
    await trigger_daily_reminders(bot)
    await bot.session.close() # Importante cerrar la sesión del bot
    print("Cron Job: trigger_daily_reminders completado.")

# Handler para Vercel
def handler(event, context):
    # Vercel llamará a esta función. Ejecutamos nuestra lógica async.
    # Aquí no necesitamos devolver una respuesta HTTP compleja, Vercel maneja el fin del cron.
    try:
        asyncio.run(_main())
        return { "statusCode": 200, "body": "Daily reminder job executed." }
    except Exception as e:
        print(f"Error en el cron job daily_reminder: {e}")
        return { "statusCode": 500, "body": f"Error: {e}" }

# Para pruebas locales (ej: python api/cron/daily_reminder.py)
# if __name__ == "__main__":
#    asyncio.run(_main())