# api/cron/random_message.py
import asyncio
import os
from dotenv import load_dotenv

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
dotenv_path = os.path.join(project_root, '.env')
if os.path.exists(dotenv_path): load_dotenv(dotenv_path)

from app.bot_instance import bot
from app.utils.scheduler_helpers import trigger_random_fun_message

async def _main():
    print("Cron Job: Iniciando trigger_random_fun_message...")
    await trigger_random_fun_message(bot)
    await bot.session.close()
    print("Cron Job: trigger_random_fun_message completado.")

def handler(event, context):
    try:
        asyncio.run(_main())
        return { "statusCode": 200, "body": "Random message job executed." }
    except Exception as e:
        print(f"Error en el cron job random_message: {e}")
        return { "statusCode": 500, "body": f"Error: {e}" }