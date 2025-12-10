# 🚀 AI Actions System - Deployment Checklist

## 📋 Pre-Deployment

### ✅ Prerequisites

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL 14+ configurado y accesible
- [ ] Cuenta de Telegram Bot (Bot Token)
- [ ] Cerebras API Key obtenida
- [ ] Vercel/Netlify/AWS configurado (si aplica)

### ✅ Environment Variables

Verificar que todas las variables de entorno estén configuradas:

```env
# Required
DATABASE_URL=postgresql://user:password@host:5432/database
TELEGRAM_BOT_TOKEN=your_bot_token_here
CEREBRAS_API_KEY=your_cerebras_api_key_here

# Optional
NODE_ENV=production
```

- [ ] `DATABASE_URL` configurado correctamente
- [ ] `TELEGRAM_BOT_TOKEN` válido
- [ ] `CEREBRAS_API_KEY` válido
- [ ] Variables de entorno verificadas en el servidor

---

## 🗄️ Database Setup

### ✅ Tables Verification

Verificar que todas las tablas necesarias existan:

- [ ] `team_members` - Tabla de miembros del equipo
- [ ] `tasks` - Tabla de tareas
- [ ] `oracle_memories` - Memorias del oráculo (si aplica)
- [ ] `stickers` - Catálogo de stickers (si aplica)
- [ ] `work_documents` - Documentos (si aplica)
- [ ] `group_config` - Configuración por grupo (si aplica)
- [ ] `ai_memory` - **NUEVA** Memoria persistente de IA (se crea automáticamente)

### ✅ Table Schema Verification

Verificar esquema de `ai_memory`:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_memory';
```

Debe tener:
- [ ] `id` (SERIAL PRIMARY KEY)
- [ ] `chat_id` (BIGINT NOT NULL)
- [ ] `key` (VARCHAR(255) NOT NULL)
- [ ] `value` (JSONB NOT NULL)
- [ ] `created_at` (TIMESTAMP)
- [ ] `updated_at` (TIMESTAMP)
- [ ] UNIQUE constraint en (chat_id, key)
- [ ] Índices en chat_id y key

### ✅ Database Permissions

- [ ] Usuario de BD tiene permisos SELECT, INSERT, UPDATE, DELETE
- [ ] Usuario de BD puede crear tablas (para ai_memory)
- [ ] Usuario de BD puede crear índices

---

## 📦 Code Deployment

### ✅ New Files Deployed

Verificar que los siguientes archivos nuevos estén en el servidor:

**AI System Core:**
- [ ] `lib/ai/actionParser.js`
- [ ] `lib/ai/sqlValidator.js`
- [ ] `lib/ai/actionExecutor.js`
- [ ] `lib/ai/systemPrompt.js`
- [ ] `lib/ai/index.js`

**Commands:**
- [ ] `lib/commands/aiActionsCommands.js`

**Documentation:**
- [ ] `docs/AI_ACTIONS_README.md`
- [ ] `docs/AI_ACTIONS_SUMMARY.md`
- [ ] `docs/DEPLOYMENT_CHECKLIST.md` (este archivo)

### ✅ Modified Files Deployed

Verificar que las modificaciones estén aplicadas:

- [ ] `pages/api/chat.js` - Integración con AI Actions
- [ ] `pages/api/webhook.js` - Manejo de respuestas con acciones
- [ ] `lib/commands/registerCommands.js` - Registro de nuevos comandos
- [ ] `lib/services/commandRegistry.js` - Nueva función getCommandsArray

### ✅ Dependencies

Verificar que todas las dependencias estén instaladas:

```bash
npm install
```

- [ ] `@cerebras/cerebras_cloud_sdk` instalado
- [ ] `pg` (PostgreSQL client) instalado
- [ ] `node-fetch` instalado
- [ ] Todas las dependencias sin errores

### ✅ Build Success

- [ ] `npm run build` ejecutado sin errores
- [ ] No hay errores de TypeScript/ESLint
- [ ] No hay warnings críticos

---

## 🔍 Post-Deployment Verification

### ✅ System Initialization

Al iniciar el servidor, verificar logs:

```
✅ System initialized successfully!
✅ Command system initialized successfully!
✅ All commands registered successfully!
```

- [ ] Sistema se inicia sin errores
- [ ] Base de datos conecta exitosamente
- [ ] Comandos se registran correctamente

### ✅ Commands Registration

Verificar que los 5 nuevos comandos estén registrados:

- [ ] `/aiactions` registrado
- [ ] `/aistatus` registrado
- [ ] `/aitables` registrado
- [ ] `/aimemory` registrado
- [ ] `/aitest` registrado

### ✅ Webhook Connection

- [ ] Webhook de Telegram conectado
- [ ] Bot responde a mensajes
- [ ] No hay errores 500/502/504

---

## 🧪 Testing Procedures

### ✅ Test 1: Commands Work

Ejecutar cada comando nuevo en Telegram:

```
/aiactions
Expected: Documentación enviada ✅

/aistatus
Expected: Estado del sistema mostrado ✅

/aitables
Expected: Lista de 7 tablas ✅

/aimemory list
Expected: "No tiene memorias" o lista de memorias ✅

/aitest (admin only)
Expected: Requiere texto o muestra resultado ✅
```

- [ ] Todos los comandos responden
- [ ] No hay errores en logs
- [ ] Formato de mensajes correcto

### ✅ Test 2: AI Actions - SQL

Probar que la IA puede ejecutar SQL:

```
Usuario: "Cuántas tareas hay?"
Esperado: IA ejecuta SELECT y responde con número real

Usuario: "Muestra los miembros del equipo"
Esperado: IA ejecuta SELECT y lista miembros reales
```

Verificar en logs:

```
🤖 ===== AI ACTIONS PROCESSING START =====
📊 Parsing Results: Valid actions: 1
🗄️ Executing SQL: SELECT...
✅ Action completed successfully
```

- [ ] SQL se ejecuta correctamente
- [ ] Datos reales son devueltos
- [ ] Logs muestran ejecución exitosa

### ✅ Test 3: AI Actions - Memory

Probar memoria persistente:

```
Usuario: "Recuerda que uso VS Code"
Esperado: IA guarda en memoria

Usuario: "Qué editor uso?"
Esperado: IA lee de memoria y responde "VS Code"
```

- [ ] Memoria se guarda en `ai_memory`
- [ ] Memoria se recupera correctamente
- [ ] `/aimemory list` muestra la memoria guardada

### ✅ Test 4: AI Actions - Telegram

Probar control de mensajes:

```
Usuario: "Completa la tarea #1 y avísame"
Esperado: IA actualiza BD y envía mensaje de confirmación
```

- [ ] Mensaje de confirmación enviado
- [ ] Formato correcto (HTML/Markdown)

### ✅ Test 5: Security Validation

Intentar operaciones que deben ser bloqueadas:

**Test SQL Injection (debe fallar):**
- Mensaje que intente inyección SQL
- Esperado: Query rechazado por validator

**Test Multi-tenancy (debe filtrar):**
- Query sin `WHERE chat_id`
- Esperado: Rechazado con error "requires chat_id filtering"

**Test Dangerous Operations (debe fallar):**
- Query con DROP/TRUNCATE/ALTER
- Esperado: Rechazado con error "not allowed"

- [ ] SQL injection bloqueado ✅
- [ ] Multi-tenancy forzado ✅
- [ ] Operaciones peligrosas bloqueadas ✅

### ✅ Test 6: Error Recovery

Probar auto-corrección:

```
1. Enviar mensaje que cause error en SQL
2. Verificar que IA reintente
3. Verificar que se corrija o informe error
```

Verificar en logs:

```
⚠️ Attempt 1 failed, retrying...
✅ Attempt 2 completed successfully
```

- [ ] Retry logic funciona
- [ ] IA se auto-corrige
- [ ] Máximo 3 intentos respetado

### ✅ Test 7: Multi-Group Isolation

Probar en 2 grupos diferentes:

**Grupo A:**
```
Usuario A: "Recuerda que usamos React"
```

**Grupo B:**
```
Usuario B: "Qué framework usamos?"
Esperado: NO debe ver "React" del Grupo A
```

- [ ] Datos aislados por chat_id ✅
- [ ] No hay leakage entre grupos ✅

---

## 📊 Monitoring

### ✅ Logs to Monitor

Después del deployment, monitorear:

**Success Indicators:**
```
✅ Action completed successfully
📈 Execution Results: Success: true
```

**Warning Indicators:**
```
⚠️ Attempt X failed, retrying...
⚠️ Invalid Actions: X
```

**Error Indicators:**
```
❌ Action failed after 3 attempts
❌ SQL validation failed
❌ Fatal error during execution
```

- [ ] Logs están siendo generados
- [ ] Más éxitos que errores
- [ ] Errores no son críticos

### ✅ Metrics to Track

Durante las primeras 24-48 horas:

- [ ] Número de acciones ejecutadas
- [ ] Tasa de éxito de acciones (target: >95%)
- [ ] Tiempo promedio de ejecución (target: <2s)
- [ ] Número de reintentos necesarios
- [ ] Uso de memoria de BD

### ✅ Performance

- [ ] Respuestas de IA en <3 segundos
- [ ] Queries SQL en <1 segundo
- [ ] No hay timeouts
- [ ] CPU y memoria dentro de límites

---

## 🔄 Rollback Plan

### Si algo sale mal:

1. **Identificar el problema:**
   - [ ] Revisar logs de error
   - [ ] Identificar componente afectado

2. **Rollback parcial (opción 1):**
   ```javascript
   // En pages/api/chat.js, deshabilitar AI Actions:
   const result = await getAiResponse(messages, user, chatId, {
     enableActions: false  // ← Deshabilitar temporalmente
   });
   ```
   - [ ] Bot sigue funcionando
   - [ ] AI Actions deshabilitado
   - [ ] Comandos básicos funcionan

3. **Rollback completo (opción 2):**
   - [ ] Revertir a commit anterior
   - [ ] Re-deploy versión estable
   - [ ] Verificar funcionamiento

4. **Mantener datos:**
   - [ ] NO eliminar tabla `ai_memory`
   - [ ] Memoria persistente se mantiene
   - [ ] Se puede volver a habilitar después

---

## 📝 Post-Deployment Checklist

### ✅ Documentation

- [ ] README actualizado con AI Actions
- [ ] Equipo notificado de nuevas capacidades
- [ ] Guía de usuario creada
- [ ] Ejemplos de uso compartidos

### ✅ Communication

- [ ] Enviar a grupo de Telegram:
  ```
  🎉 ¡Nueva función disponible!
  
  Moe ahora puede ejecutar acciones autónomas:
  - Consultar BD en tiempo real
  - Gestionar su memoria
  - Auto-corregirse
  
  Usa /aiactions para más info.
  ```

- [ ] Mensaje enviado
- [ ] Feedback inicial recopilado

### ✅ Backup

- [ ] Backup de BD realizado
- [ ] Backup de código realizado
- [ ] Plan de recuperación documentado

---

## ✅ Success Criteria

El deployment es exitoso si:

- [x] ✅ Todos los 5 comandos nuevos funcionan
- [x] ✅ IA puede ejecutar SQL queries
- [x] ✅ IA puede guardar/leer memoria
- [x] ✅ Seguridad validada (no SQL injection)
- [x] ✅ Multi-tenancy funciona (aislamiento por grupo)
- [x] ✅ Retry logic funciona en errores
- [x] ✅ No hay errores críticos en logs
- [x] ✅ Performance es aceptable (<3s respuestas)
- [x] ✅ Usuarios pueden interactuar naturalmente

---

## 🆘 Support & Troubleshooting

### Common Issues:

**Issue 1: "ai_memory table does not exist"**
```sql
-- Ejecutar manualmente:
CREATE TABLE IF NOT EXISTS ai_memory (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, key)
);
```

**Issue 2: "SQL validation failed: Parameter count mismatch"**
- Revisar que placeholders ($1, $2) coincidan con array params
- Verificar en logs el query exacto

**Issue 3: "Action failed after 3 attempts"**
- Revisar error específico en logs
- Puede ser problema de permisos de BD
- Verificar conexión a BD

**Issue 4: Commands not registered**
- Reiniciar servidor
- Verificar `initializeCommandSystem()` se ejecutó
- Verificar logs de registro de comandos

### Contact:

- 📧 Logs: Revisar Vercel/server logs
- 📚 Docs: `docs/AI_ACTIONS_README.md`
- 🐛 Issues: GitHub Issues
- 💬 Chat: Telegram group

---

**Deployment Date:** _________________

**Deployed By:** _________________

**Verified By:** _________________

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**STATUS:** [ ] ✅ COMPLETED | [ ] ⚠️ PARTIAL | [ ] ❌ FAILED