# app/services/moe_handler.py
import json
import os
import random
import re
from app.utils.markdown_escaper import escape_markdown_v2 # O usa el de Aiogram

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
PHRASES_FILE_PATH = os.path.join(DATA_DIR, 'fun_phrases.json')

_fun_phrases = {
  "general_encouragement": ["¡Ánimo equipo! ✨"],
  "kaomoji_expressions": ["(＾▽＾)"],
  "developer_humor": ["Error 404: Chiste not found... 😉"],
  "moe_responses": ["Nya~ :3"]
}

try:
    with open(PHRASES_FILE_PATH, 'r', encoding='utf-8') as f:
        loaded_phrases = json.load(f)
        for key in _fun_phrases.keys():
            if loaded_phrases.get(key) and isinstance(loaded_phrases[key], list):
                _fun_phrases[key] = loaded_phrases[key]
    print("Frases divertidas cargadas exitosamente desde JSON.")
except Exception as e:
    print(f"Error al cargar fun_phrases.json, usando valores por defecto: {e}")

_MOE_TRIGGERS_REGEX = [re.compile(r"(?:^|\s)(uwu|owo|:\s*3|nya|ñya)(?:$|\s)", re.IGNORECASE)]

def get_moe_response(text: str) -> str | None:
    if not text:
        return None
    lower_text = text.lower()
    for trigger_regex in _MOE_TRIGGERS_REGEX:
        if trigger_regex.search(lower_text):
            response = random.choice(_fun_phrases["moe_responses"])
            kaomoji = random.choice(_fun_phrases["kaomoji_expressions"])
            return f"{escape_markdown_v2(response)} {kaomoji}" # Escapar por si acaso
    return None

def get_random_fun_phrase() -> dict[str, str]:
    all_purpose_phrases = (
        _fun_phrases["general_encouragement"] +
        _fun_phrases["developer_humor"]
    )
    if not all_purpose_phrases: # Fallback
        phrase = "¡Que tengas un buen día!"
    else:
        phrase = random.choice(all_purpose_phrases)

    kaomoji = random.choice(_fun_phrases["kaomoji_expressions"]) if _fun_phrases["kaomoji_expressions"] else "(^-^)"
    return {"phrase": escape_markdown_v2(phrase), "kaomoji": kaomoji}


def get_random_phrase_for_scheduler() -> str:
    data = get_random_fun_phrase()
    return f"{data['phrase']} {data['kaomoji']}"