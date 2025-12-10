# 🤖 AI Actions System - Documentación Completa

## 📋 Índice

1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Tipos de Acciones](#tipos-de-acciones)
4. [Seguridad](#seguridad)
5. [Uso Básico](#uso-básico)
6. [Ejemplos Avanzados](#ejemplos-avanzados)
7. [Comandos Disponibles](#comandos-disponibles)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

**AI Actions** es un sistema revolucionario que permite a la IA de MoeTasker ejecutar acciones de forma autónoma en respuesta a solicitudes en lenguaje natural. En lugar de solo simular respuestas, la IA puede:

- ✅ Ejecutar queries SQL reales en la base de datos
- ✅ Enviar, editar y eliminar mensajes de Telegram
- ✅ Gestionar su propia memoria persistente
- ✅ Auto-corregirse cuando hay errores
- ✅ Mantener contexto entre conversaciones

### ¿Por qué es importante?

**Antes de AI Actions:**
```
Usuario: "Muéstrame las tareas pendientes"
IA: "Claro, aquí están las tareas pendientes: [simula una lista]"
❌ Los datos no son reales, solo simulados
```

**Con AI Actions:**
```
Usuario: "Muéstrame las tareas pendientes"
IA ejecuta: SELECT * FROM tasks WHERE chat_id = $1 AND status = 'pending'
IA: "Aquí están tus 3 tareas pendientes:
     1. Revisar código (#42)
     2. Deploy a producción (#43)
     3. Actualizar docs (#44)"
✅ Datos reales de la base de datos
```

---

## 🏗️ Arquitectura

### Flujo Completo

```
┌─────────────────┐
│  Usuario envía  │
│    mensaje      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Webhook de    │
│    Telegram     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  IA (Cerebras)  │
│  genera respue- │
│  sta con accio- │
│  nes embedidas  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Action Parser  │
│  extrae [ACTION]│
│     blocks      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SQL Validator   │
│  valida queries │
│  y seguridad    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Action Executor │
│  ejecuta con    │
│  retry logic    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Resultado se   │
│  envía al chat  │
└─────────────────┘
```

### Componentes Principales

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| **Action Parser** | `lib/ai/actionParser.js` | Extrae y parsea acciones del texto de la IA |
| **SQL Validator** | `lib/ai/sqlValidator.js` | Valida y sanitiza queries SQL |
| **Action Executor** | `lib/ai/actionExecutor.js` | Ejecuta acciones con retry logic |
| **System Prompt** | `lib/ai/systemPrompt.js` | Genera prompts que enseñan a la IA |
| **Main Orchestrator** | `lib/ai/index.js` | Coordina todo el sistema |

---

## 🎭 Tipos de Acciones

### 1. 🗄️ SQL - Acceso a Base de Datos

Permite a la IA ejecutar queries SQL para leer y modificar datos.

**Sintaxis:**
```
[ACTION:sql]
{"query": "SELECT * FROM tasks WHERE chat_id = $1", "params": [123456]}
[/ACTION]
```

**Operaciones Permitidas:**
- `SELECT` - Consultar datos
- `INSERT` - Crear registros
- `UPDATE` - Actualizar registros
- `DELETE` - Eliminar registros

**Tablas Accesibles:**
- `tasks` - Tareas del equipo
- `team_members` - Miembros del equipo
- `oracle_memories` - Memorias del Oráculo
- `stickers` - Catálogo de stickers
- `work_documents` - Documentos de trabajo
- `group_config` - Configuración por grupo
- `ai_memory` - Memoria persistente de la IA

**Ejemplo Completo:**
```
Usuario: "¿Cuántas tareas pendientes tengo?"

IA genera:
Déjame consultar tus tareas pendientes.

[ACTION:sql]
{
  "query": "SELECT COUNT(*) as total FROM tasks WHERE chat_id = $1 AND status = $2 AND assigned_to = $3",
  "params": ["{chat_id}", "pending", "{user_id}"]
}
[/ACTION]

Resultado: Tienes 5 tareas pendientes.
```

### 2. 📱 Telegram - Interacción con Mensajes

Permite a la IA enviar, editar y eliminar mensajes.

**Sintaxis:**
```
[ACTION:telegram]
{"action": "sendMessage", "chat_id": "{chat_id}", "text": "¡Hola!"}
[/ACTION]
```

**Acciones Disponibles:**

#### sendMessage
```json
{
  "action": "sendMessage",
  "chat_id": "{chat_id}",
  "text": "✅ Tarea completada!",
  "parse_mode": "HTML",
  "reply_to_message_id": 123
}
```

#### editMessage
```json
{
  "action": "editMessage",
  "chat_id": "{chat_id}",
  "message_id": 456,
  "text": "Mensaje actualizado"
}
```

#### deleteMessage
```json
{
  "action": "deleteMessage",
  "chat_id": "{chat_id}",
  "message_id": 789
}
```

#### sendSticker
```json
{
  "action": "sendSticker",
  "chat_id": "{chat_id}",
  "sticker": "CAACAgIAAxkBAAIC..."
}
```

**Ejemplo Completo:**
```
Usuario: "Marca la tarea #42 como completada y avísame"

IA genera:
[ACTION:sql]
{"query": "UPDATE tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 AND chat_id = $3", "params": ["completed", 42, "{chat_id}"]}
[/ACTION]

[ACTION:telegram]
{"action": "sendMessage", "chat_id": "{chat_id}", "text": "✅ Tarea #42 completada exitosamente!"}
[/ACTION]

¡Listo! La tarea ha sido marcada como completada.
```

### 3. 🧠 Memory - Memoria Persistente

Permite a la IA guardar y recuperar información entre conversaciones.

**Sintaxis:**
```
[ACTION:memory]
{"operation": "save", "key": "last_task", "value": {"id": 42, "date": "2024-01-15"}}
[/ACTION]
```

**Operaciones:**

#### save - Guardar en memoria
```json
{
  "operation": "save",
  "key": "preferences",
  "value": {"language": "es", "notifications": true}
}
```

#### get - Recuperar de memoria
```json
{
  "operation": "get",
  "key": "preferences"
}
```

#### delete - Eliminar de memoria
```json
{
  "operation": "delete",
  "key": "old_data"
}
```

#### list - Listar todas las memorias
```json
{
  "operation": "list"
}
```

**Ejemplo Completo:**
```
Usuario: "Recuerda que los viernes hacemos code review"

IA genera:
[ACTION:memory]
{
  "operation": "save",
  "key": "team_schedule",
  "value": {
    "friday": "code review",
    "saved_at": "2024-01-15T10:30:00Z"
  }
}
[/ACTION]

¡Entendido! He guardado que los viernes hacen code review. No lo olvidaré~ (◕‿◕✿)
```

---

## 🛡️ Seguridad

### Validación de SQL

✅ **Queries Parametrizadas**
```sql
-- ✅ CORRECTO
SELECT * FROM tasks WHERE chat_id = $1 AND id = $2

-- ❌ INCORRECTO (inyección SQL)
SELECT * FROM tasks WHERE chat_id = 123 AND id = ' OR '1'='1
```

✅ **Multi-Tenancy Enforcement**
```sql
-- ✅ CORRECTO - Incluye chat_id
SELECT * FROM tasks WHERE chat_id = $1

-- ❌ INCORRECTO - No filtra por chat_id
SELECT * FROM tasks
```

✅ **Whitelist de Tablas**
```sql
-- ✅ CORRECTO - Tabla permitida
SELECT * FROM tasks WHERE chat_id = $1

-- ❌ INCORRECTO - Tabla no permitida
SELECT * FROM users WHERE id = 1
```

✅ **Blacklist de Operaciones Peligrosas**
```sql
-- ❌ Todas estas son bloqueadas:
DROP TABLE tasks;
TRUNCATE tasks;
ALTER TABLE tasks ADD COLUMN...;
GRANT ALL PRIVILEGES...;
```

### Límites de Seguridad

| Límite | Valor | Propósito |
|--------|-------|-----------|
| Max SELECT results | 100 rows | Prevenir queries costosos |
| Max UPDATE/DELETE | 50 rows | Prevenir cambios masivos accidentales |
| Query timeout | 5000 ms | Prevenir queries lentos |
| Max retries | 3 | Evitar loops infinitos |

### Variables Contextuales Seguras

Las siguientes variables se reemplazan automáticamente:

| Variable | Se reemplaza con | Ejemplo |
|----------|------------------|---------|
| `{chat_id}` | ID del chat actual | `123456789` |
| `{user_id}` | ID del usuario que envió mensaje | `987654321` |
| `{username}` | Username del usuario | `"@johndoe"` |

---

## 🚀 Uso Básico

### Para Usuarios

Simplemente habla con la IA de forma natural. Ella decidirá cuándo ejecutar acciones.

**Ejemplos:**

```
👤 "Muéstrame mis tareas"
🤖 [Ejecuta SELECT y muestra resultados reales]

👤 "Crea una tarea urgente para revisar el PR"
🤖 [Ejecuta INSERT y confirma]

👤 "Recuerda que uso VS Code"
🤖 [Guarda en memoria]

👤 "¿Qué editor uso?"
🤖 [Lee de memoria y responde]
```

### Para Desarrolladores

La IA aprende de los ejemplos en el system prompt. Puedes probar acciones manualmente:

```javascript
import { processAIResponseWithActions } from '@/lib/ai';

const aiResponse = `
Aquí están tus tareas:

[ACTION:sql]
{"query": "SELECT * FROM tasks WHERE chat_id = $1", "params": [123]}
[/ACTION]
`;

const context = {
  chat_id: 123,
  user_id: 456
};

const result = await processAIResponseWithActions(aiResponse, context);
console.log(result);
```

---

## 💡 Ejemplos Avanzados

### Caso 1: Crear y Asignar Tarea

```
Usuario: "Crea una tarea para revisar el código y asígnala a Juan"

IA genera:
[ACTION:sql]
{
  "query": "SELECT user_id FROM team_members WHERE chat_id = $1 AND (username = $2 OR first_name = $2)",
  "params": ["{chat_id}", "Juan"]
}
[/ACTION]

[ACTION:sql]
{
  "query": "INSERT INTO tasks (chat_id, description, status, assigned_to, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *",
  "params": ["{chat_id}", "Revisar el código", "pending", 123456]
}
[/ACTION]

[ACTION:memory]
{
  "operation": "save",
  "key": "last_task_created",
  "value": {"description": "Revisar el código", "assigned_to": "Juan", "timestamp": "2024-01-15"}
}
[/ACTION]

¡Listo! He creado la tarea "Revisar el código" y se la asigné a Juan (◕‿◕✿)
```

### Caso 2: Estadísticas con Múltiples Queries

```
Usuario: "Dame un resumen del equipo"

IA genera:
[ACTION:sql]
{"query": "SELECT COUNT(*) as total FROM team_members WHERE chat_id = $1", "params": ["{chat_id}"]}
[/ACTION]

[ACTION:sql]
{"query": "SELECT COUNT(*) as total FROM tasks WHERE chat_id = $1 AND status = $2", "params": ["{chat_id}", "pending"]}
[/ACTION]

[ACTION:sql]
{"query": "SELECT COUNT(*) as total FROM tasks WHERE chat_id = $1 AND status = $2", "params": ["{chat_id}", "completed"]}
[/ACTION]

📊 Resumen del equipo:
• Miembros: 5
• Tareas pendientes: 12
• Tareas completadas: 38
```

### Caso 3: Auto-corrección

```
Usuario: "Cuántas tareas hay?"

IA (primer intento - ERROR):
[ACTION:sql]
{"query": "SELECT COUNT(*) FROM tasks", "params": []}
[/ACTION]

❌ Error: Multi-tenant tables require chat_id filtering

IA (segundo intento - ÉXITO):
[ACTION:sql]
{"query": "SELECT COUNT(*) as total FROM tasks WHERE chat_id = $1", "params": ["{chat_id}"]}
[/ACTION]

Hay 15 tareas en total ✨
```

---

## 🎮 Comandos Disponibles

### `/aiactions` - Documentación
Muestra la documentación completa del sistema.

```
/aiactions
```

### `/aistatus` - Estado del Sistema
Muestra el estado de salud y capacidades.

```
/aistatus

🤖 Estado del Sistema AI Actions

📊 Estado: ✅ Saludable
⏰ Timestamp: 15/1/2024 10:30:00

🔧 Capacidades:
   • SQL: ✅
   • Telegram: ✅
   • Memory: ✅

🛡️ Seguridad:
   • Tablas permitidas: 7
   • Operaciones permitidas: 4
   • Límite SELECT: 100 rows
   • Límite UPDATE/DELETE: 50 rows
```

### `/aitables` - Tablas Disponibles
Lista las tablas accesibles por la IA.

```
/aitables

🗄️ Tablas Permitidas para AI Actions

• tasks - Gestión de tareas
• team_members - Miembros del equipo
• ai_memory - Memoria persistente
...
```

### `/aimemory` - Gestión de Memoria
Gestiona la memoria persistente de la IA.

```
/aimemory list          # Listar todas las memorias
/aimemory get preferences  # Ver una memoria específica
/aimemory clear         # Limpiar todas las memorias
```

### `/aitest` - Testing (Admin)
Prueba el parsing de acciones sin ejecutarlas.

```
/aitest Hola [ACTION:sql]{"query":"SELECT 1"}[/ACTION]

🧪 Test de AI Actions

📊 Resultado del Parsing:
   • Tiene acciones: ✅ Sí
   • Acciones válidas: 1
   • Acciones inválidas: 0
```

---

## ✅ Mejores Prácticas

### Para la IA

1. **SIEMPRE usa queries parametrizadas**
   ```json
   ✅ {"query": "WHERE id = $1", "params": [42]}
   ❌ {"query": "WHERE id = 42", "params": []}
   ```

2. **SIEMPRE filtra por chat_id**
   ```sql
   ✅ WHERE chat_id = $1 AND status = $2
   ❌ WHERE status = 'pending'
   ```

3. **Valida antes de modificar**
   ```sql
   -- Primero SELECT para verificar
   SELECT * FROM tasks WHERE id = $1 AND chat_id = $2
   
   -- Luego UPDATE si existe
   UPDATE tasks SET status = $1 WHERE id = $2 AND chat_id = $3
   ```

4. **Usa memoria para contexto**
   ```json
   // Guardar info importante
   {"operation": "save", "key": "context", "value": {...}}
   
   // Recuperar en siguiente conversación
   {"operation": "get", "key": "context"}
   ```

### Para Desarrolladores

1. **Monitorea los logs**
   ```
   🤖 ===== AI ACTIONS PROCESSING START =====
   📝 Response length: 234 chars
   🎯 Context: {chat_id: 123, user_id: 456}
   📊 Parsing Results: Valid actions: 2
   🚀 Executing actions...
   ✅ Action 1 completed successfully
   ```

2. **Maneja errores gracefully**
   ```javascript
   const result = await processAIResponseWithActions(text, context);
   
   if (!result.success) {
     console.error('Actions failed:', result.executionResults.errors);
   }
   ```

3. **Usa dry run para testing**
   ```javascript
   const result = await processAIResponseWithActions(text, context, {
     dryRun: true  // Solo parsea, no ejecuta
   });
   ```

---

## 🔧 Troubleshooting

### Problema: "SQL validation failed: Parameter count mismatch"

**Causa:** El número de placeholders ($1, $2...) no coincide con el array de params.

**Solución:**
```json
❌ {"query": "WHERE id = $1 AND status = $2", "params": [42]}
✅ {"query": "WHERE id = $1 AND status = $2", "params": [42, "pending"]}
```

### Problema: "Multi-tenant tables require chat_id filtering"

**Causa:** Falta WHERE chat_id = $1 en el query.

**Solución:**
```sql
❌ SELECT * FROM tasks WHERE status = 'pending'
✅ SELECT * FROM tasks WHERE chat_id = $1 AND status = $2
```

### Problema: "Table 'X' is not in whitelist"

**Causa:** Intentando acceder a una tabla no permitida.

**Solución:** Solo usa las 7 tablas permitidas. Usa `/aitables` para ver la lista.

### Problema: "Action failed after 3 attempts"

**Causa:** Error persistente en la acción.

**Solución:**
1. Revisa los logs para ver el error específico
2. Verifica la sintaxis del JSON
3. Asegúrate de que los datos existen en la BD
4. Usa `/aitest` para validar sin ejecutar

### Problema: La IA no ejecuta acciones

**Causa:** `enableActions` puede estar desactivado.

**Solución:**
```javascript
const result = await getAiResponse(messages, user, chatId, {
  enableActions: true  // Asegurar que esté activado
});
```

---

## 📊 Métricas y Monitoreo

El sistema registra métricas detalladas:

```javascript
{
  success: true,
  message: "Respuesta de la IA",
  hasActions: true,
  executionResults: {
    success: true,
    totalActions: 3,
    successCount: 3,
    errorCount: 0,
    results: [
      {
        actionIndex: 0,
        type: "sql",
        success: true,
        executionTime: 45
      }
    ]
  }
}
```

---

## 🎓 Resumen

**AI Actions** transforma a MoeTasker de un simple chatbot a un asistente verdaderamente autónomo que puede:

✅ Interactuar con la base de datos de forma segura
✅ Gestionar mensajes de Telegram programáticamente
✅ Mantener memoria persistente entre conversaciones
✅ Auto-corregirse cuando comete errores
✅ Operar de forma completamente autónoma

**El resultado:** Una experiencia de usuario natural donde simplemente hablas con la IA y ella hace el resto.

---

## 📚 Referencias

- [Action Parser](../lib/ai/actionParser.js)
- [SQL Validator](../lib/ai/sqlValidator.js)
- [Action Executor](../lib/ai/actionExecutor.js)
- [System Prompt](../lib/ai/systemPrompt.js)
- [Main Orchestrator](../lib/ai/index.js)

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2024  
**Mantenedor:** Equipo MoeTasker