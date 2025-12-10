# TODO: Complete Multi-Team Migration with AI Command Awareness

## 🎯 Estado Actual del Proyecto

### ✅ Completado

- [x] Migración de Groq a Cerebras
- [x] Modelo actualizado a `gpt-oss-120b`
- [x] Sistema de base de datos multi-team (schema completo)
- [x] Servicio de miembros dinámicos (`memberService.js`)
- [x] Sistema de registro de comandos (`commandRegistry.js`)
- [x] Comandos de gestión de miembros implementados:
  - [x] `/addMember`
  - [x] `/removeMember`
  - [x] `/listMembers`
  - [x] `/memberInfo`
  - [x] `/updateMember`
  - [x] `/teamStats`
- [x] Sistema de inicialización de BD (`initDatabase.js`)
- [x] Middleware de manejo de comandos (`commandHandler.js`)
- [x] Detección de intenciones por IA
- [x] Script de inicialización del sistema (`scripts/initSystem.js`)
- [x] Guía de migración completa (`MIGRATION_GUIDE.md`)
- [x] **Integración con Webhook Principal (Tarea 1)**
  - [x] Importaciones agregadas
  - [x] Inicialización automática del sistema
  - [x] Integración de `processCommand()`
  - [x] Actualización de llamadas a `getAiResponse()` con `chatId`
- [x] **Comandos de Tareas Implementados (Tarea 2)**
  - [x] `handleAssign()` - Asignar tareas
  - [x] `handleTasks()` - Listar tareas
  - [x] `handleComplete()` - Completar tarea
  - [x] `handleClearTasks()` - Limpiar tareas
  - [x] `handleMyTasks()` - Ver mis tareas
  - [x] `handleTaskStats()` - Estadísticas de tareas
  - [x] Actualizado `taskManager.js` con soporte `chatId`
  - [x] Funciones auxiliares agregadas (`getUserTasks`, `getTaskStats`, `clear_tasks`)
  - [x] Comandos registrados en `registerCommands.js`

---

## 🚧 Tareas Pendientes

### 3. Migrar Comandos del Oráculo

**Prioridad: MEDIA** 🟡

#### 3.1 Crear `lib/commands/oracleCommands.js`

- [ ] `handleOracle()` - Consultar oráculo
- [ ] `handleSaveDecision()` - Guardar decisión

#### 3.2 Actualizar `oracleManager.js`

- [ ] Agregar `chatId` a todas las funciones
- [ ] Actualizar queries para filtrar por `chat_id`
- [ ] Actualizar `queryOracle(chatId, question)`
- [ ] Actualizar `saveDecision(chatId, decision, userId, userName)`

---

### 4. Migrar Comandos de Stickers

**Prioridad: BAJA** 🟢

#### 4.1 Crear `lib/commands/stickerCommands.js`

- [ ] `handleAddSticker()` - Agregar sticker

#### 4.2 Actualizar `stickerManager.js`

- [ ] Agregar `chatId` a todas las funciones
- [ ] Actualizar `addSticker(chatId, fileId, categories, userId)`
- [ ] Actualizar `getRandomStickerByCategories(chatId, categories)`

---

### 5. Migrar Comandos de GitHub

**Prioridad: BAJA** 🟢

#### 5.1 Crear `lib/commands/githubCommands.js`

- [ ] `handleRepoStats()` - Mostrar estadísticas de repo

#### 5.2 Actualizar `gitHubStatsService.js`

- [ ] Agregar caché por `chat_id`
- [ ] Permitir configuración de repo por grupo
- [ ] Leer config de `group_config` table

---

### 6. Configuración de Grupos

**Prioridad: MEDIA** 🟡

#### 6.1 Crear `lib/services/groupConfigService.js`

```javascript
// Funciones para manejar configuración por grupo
- getGroupConfig(chatId)
- updateGroupConfig(chatId, config)
- initializeGroupConfig(chatId, defaults)
```

- [ ] Implementar CRUD para `group_config`
- [ ] Valores por defecto para nuevos grupos
- [ ] Configuración de:
  - [ ] Idioma (language)
  - [ ] Zona horaria (timezone)
  - [ ] Repo de GitHub
  - [ ] Personalidad de IA
  - [ ] Features habilitados

#### 6.2 Comando `/groupConfig`

- [ ] Crear handler para ver/modificar configuración
- [ ] Solo admins pueden modificar
- [ ] Interfaz con botones inline

---

### 7. Sistema de Permisos

**Prioridad: MEDIA** 🟡

#### 7.1 Verificación de admin

```javascript
import { getChatAdministrators } from '@/utils/telegram';

async function isAdmin(chatId, userId) {
  const admins = await getChatAdministrators(chatId);
  return admins.some(admin => admin.user.id === userId);
}
```

- [ ] Agregar verificación de admin en comandos que lo requieran
- [ ] Implementar middleware de permisos en `commandHandler.js`
- [ ] Actualizar `handleClearTasks()` para verificar permisos

---

### 8. Auto-inicialización en Nuevos Grupos

**Prioridad: ALTA** 🔴

Cuando el bot se agrega a un grupo:
- [ ] Detectar evento `new_chat_members` en webhook
- [ ] Inicializar `group_config` para el grupo
- [ ] Enviar mensaje de bienvenida con `/help`
- [ ] Agregar primer admin automáticamente

---

### 9. Testing y Debugging

**Prioridad: ALTA** 🔴

#### 9.1 Tests básicos

- [ ] Probar `/addMember` en grupo de prueba
- [ ] Probar `/assign` con múltiples tareas
- [ ] Probar `/tasks` y `/complete`
- [ ] Verificar que IA detecta intenciones
- [ ] Probar comandos en español (aliases)

#### 9.2 Logs mejorados

- [ ] Agregar más logs de debugging en webhook
- [ ] Log de comandos ejecutados por IA
- [ ] Métricas de tiempo de respuesta

---

### 10. Limpieza de Código Legacy

**Prioridad: MEDIA** 🟡

#### 10.1 Remover código antiguo del webhook

- [ ] Eliminar comandos hardcodeados que ya están en el nuevo sistema
- [ ] Mantener solo lógica especial (vision, callbacks, etc.)
- [ ] Agregar comentarios de compatibilidad

#### 10.2 Deprecar archivos antiguos

- [ ] Marcar `teamManager.js` como deprecated
- [ ] Agregar warnings en funciones antiguas
- [ ] Documentar migración

---

### 11. Documentación

**Prioridad: BAJA** 🟢

- [ ] Actualizar README.md con nuevas features
- [ ] Crear guía de inicio rápido (QUICK_START.md)
- [ ] Documentar comandos disponibles
- [ ] Agregar ejemplos de uso de IA

---

## 📋 Checklist de Pre-Deployment

Antes de hacer deploy a producción:

- [ ] **Instalar dependencias nuevas**
  ```bash
  npm install
  ```

- [ ] **Configurar variables de entorno**
  ```bash
  cp .env.example .env
  # Editar .env con tus valores
  ```

- [ ] **Inicializar base de datos**
  ```bash
  npm run init:db
  ```

- [ ] **Verificar que el bot arranca sin errores**
  ```bash
  npm run dev
  # Verificar logs de inicialización
  ```

- [ ] **Probar comandos básicos**
  - [ ] Agregar el bot a un grupo de prueba
  - [ ] Ejecutar `/help`
  - [ ] Ejecutar `/addMember` (reply a un mensaje)
  - [ ] Ejecutar `/listMembers`
  - [ ] Probar asignación de tareas

---

## 🎯 Siguientes Pasos Inmediatos

### Para hacer el bot funcional AHORA:

1. **Instalar dependencias** (5 min)
   ```bash
   npm install
   ```

2. **Configurar .env** (5 min)
   - Copiar `.env.example` a `.env`
   - Agregar `DATABASE_URL`
   - Agregar `TELEGRAM_BOT_TOKEN`
   - Agregar `CEREBRAS_API_KEY`

3. **Inicializar BD** (2 min)
   ```bash
   npm run init:db
   ```

4. **Iniciar bot** (1 min)
   ```bash
   npm run dev
   ```

5. **Pruebas básicas** (10 min)
   - Agregar bot a grupo
   - Probar `/addMember`
   - Probar `/assign Task1, Task2`
   - Probar detección de IA: "Moe, agrega a Juan al equipo"

---

## 🐛 Issues Conocidos a Resolver

1. **Edge Runtime vs Node Runtime**
   - La inicialización de comandos puede causar problemas en Edge runtime
   - **Workaround**: Inicialización lazy o cambiar a Node runtime

2. **getChatMember con username**
   - No siempre funciona si el usuario no ha interactuado
   - **Solución**: Documentar limitación, pedir reply a mensajes

3. **Comandos antiguos en webhook**
   - Todavía existe código legacy de comandos
   - **TODO**: Limpiar después de verificar que todo funciona

---

## 📊 Progreso General

**Completado**: ~75% ✅

### Desglose por módulo:
- ✅ Core System (Database, Members, Commands): 100%
- ✅ Webhook Integration: 100%
- ✅ Task Management: 100%
- 🚧 Oracle/Decisions: 0%
- 🚧 Stickers: 0%
- 🚧 GitHub Stats: 0%
- 🚧 Group Config: 0%
- ⚠️ Testing: 20%
- ⚠️ Documentation: 60%

---

## 🎉 Cuando Esté Todo Listo

El bot podrá:
- ✅ Operar en múltiples grupos simultáneamente
- ✅ Gestionar miembros dinámicamente
- ✅ Asignar y completar tareas por grupo
- ✅ Detectar intenciones y ejecutar comandos automáticamente
- ✅ Responder en español con personalidad moe
- ✅ Usar el modelo Llama 4 Scout de Cerebras
- ⏳ Consultar el oráculo (pendiente)
- ⏳ Mostrar stats de GitHub (pendiente)
- ⏳ Gestionar stickers (pendiente)

---

**Última actualización**: En progreso
**Versión del sistema**: 2.0.0-beta
**Estado**: 🚀 75% Completo - Listo para Testing Inicial

---

*¡Vamos bien, senpai! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧*