# app/utils/markdown_escaper.py
import re

# Caracteres a escapar para MarkdownV2
# _ * [ ] ( ) ~ ` > # + - = | { } . !
# Aiogram tiene un helper, pero si necesitas control manual:
_MarkdownV2Characters = r"_*[]()~`>#+-=|{}.!"

def escape_markdown_v2(text: str) -> str:
    """Escapa caracteres especiales para MarkdownV2."""
    return re.sub(f"([{re.escape(_MarkdownV2Characters)}])", r"\\\1", text)

# Aiogram provee: from aiogram.utils.markdown import escape_md
# Puedes usar ese directamente en lugar de este helper si prefieres.
# from aiogram.utils.markdown import hbold, hitalic, hcode, hlink, hunderline, hstrikethrough

# Ejemplo de uso de los helpers de Aiogram:
# from aiogram.utils.markdown import hbold
# text = f"Esto es {hbold('negrita')}"