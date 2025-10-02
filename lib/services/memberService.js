// lib/services/memberService.js
import { query } from "@/lib/db";

/**
 * Servicio para gestionar miembros del equipo de forma dinámica.
 * Soporta múltiples equipos, cada uno vinculado a un grupo de Telegram específico.
 */

/**
 * Inicializa la tabla de miembros si no existe.
 * Cada miembro está vinculado a un chat_id específico (grupo de Telegram).
 */
export async function initializeMembersTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS team_members (
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      username VARCHAR(255),
      custom_name VARCHAR(255),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      role VARCHAR(255) DEFAULT 'Team Member',
      bio TEXT,
      is_active BOOLEAN DEFAULT true,
      added_by BIGINT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, chat_id)
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_chat_id ON team_members(chat_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(chat_id, is_active);
  `;

  try {
    await query(createTableQuery);
    console.log("✅ Table team_members initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing team_members table:", error);
    throw error;
  }
}

/**
 * Agrega un nuevo miembro al equipo de un grupo específico.
 * @param {number|string} chatId - ID del grupo de Telegram
 * @param {Object} memberData - Datos del miembro
 * @param {number} memberData.userId - ID de Telegram del usuario
 * @param {string} [memberData.username] - Username de Telegram (sin @)
 * @param {string} [memberData.customName] - Nombre personalizado
 * @param {string} [memberData.firstName] - Primer nombre
 * @param {string} [memberData.lastName] - Apellido
 * @param {string} [memberData.role] - Rol en el equipo
 * @param {string} [memberData.bio] - Biografía
 * @param {number} addedBy - ID del usuario que agrega al miembro
 * @returns {Promise<Object>} El miembro agregado
 */
export async function addMember(chatId, memberData, addedBy) {
  const {
    userId,
    username = null,
    customName = null,
    firstName = null,
    lastName = null,
    role = "Team Member",
    bio = null,
  } = memberData;

  // Verificar si el miembro ya existe en este grupo
  const existing = await getMemberById(chatId, userId);
  if (existing) {
    // Si existe pero está inactivo, reactivarlo
    if (!existing.is_active) {
      return await reactivateMember(chatId, userId, addedBy);
    }
    throw new Error(
      `Member with ID ${userId} already exists in this group. Use updateMember to modify.`,
    );
  }

  const insertQuery = `
    INSERT INTO team_members
      (user_id, chat_id, username, custom_name, first_name, last_name, role, bio, added_by)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    userId,
    chatId,
    username,
    customName,
    firstName,
    lastName,
    role,
    bio,
    addedBy,
  ];

  try {
    const result = await query(insertQuery, values);
    console.log(
      `✅ Member added to group ${chatId}: ${customName || firstName || username || userId}`,
    );
    return result.rows[0];
  } catch (error) {
    console.error("❌ Error adding member:", error);
    throw error;
  }
}

/**
 * Reactiva un miembro previamente eliminado.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID del usuario
 * @param {number} reactivatedBy - ID del usuario que reactiva
 * @returns {Promise<Object>} El miembro reactivado
 */
async function reactivateMember(chatId, userId, reactivatedBy) {
  const updateQuery = `
    UPDATE team_members
    SET is_active = true,
        added_by = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND chat_id = $2
    RETURNING *;
  `;

  try {
    const result = await query(updateQuery, [userId, chatId, reactivatedBy]);
    console.log(`✅ Member reactivated in group ${chatId}: ${userId}`);
    return result.rows[0];
  } catch (error) {
    console.error("❌ Error reactivating member:", error);
    throw error;
  }
}

/**
 * Obtiene un miembro por su ID de Telegram en un grupo específico.
 * @param {number|string} chatId - ID del grupo de Telegram
 * @param {number|string} userId - ID de Telegram del usuario
 * @returns {Promise<Object|null>} El miembro o null si no existe
 */
export async function getMemberById(chatId, userId) {
  const selectQuery = `
    SELECT * FROM team_members
    WHERE chat_id = $1 AND user_id = $2 AND is_active = true;
  `;

  try {
    const result = await query(selectQuery, [chatId, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("❌ Error getting member by ID:", error);
    return null;
  }
}

/**
 * Obtiene todos los miembros activos de un grupo específico.
 * @param {number|string} chatId - ID del grupo de Telegram
 * @returns {Promise<Array>} Lista de miembros activos
 */
export async function getAllMembers(chatId) {
  const selectQuery = `
    SELECT * FROM team_members
    WHERE chat_id = $1 AND is_active = true
    ORDER BY added_at ASC;
  `;

  try {
    const result = await query(selectQuery, [chatId]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error getting all members:", error);
    return [];
  }
}

/**
 * Actualiza la información de un miembro en un grupo específico.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID de Telegram del usuario
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object|null>} El miembro actualizado
 */
export async function updateMember(chatId, userId, updates) {
  const allowedFields = [
    "username",
    "custom_name",
    "first_name",
    "last_name",
    "role",
    "bio",
  ];
  const updateFields = [];
  const values = [chatId, userId]; // Empezamos con chatId y userId
  let paramIndex = 3; // Los parámetros empiezan desde $3

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  // Agregar updated_at
  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

  const updateQuery = `
    UPDATE team_members
    SET ${updateFields.join(", ")}
    WHERE chat_id = $1 AND user_id = $2 AND is_active = true
    RETURNING *;
  `;

  try {
    const result = await query(updateQuery, values);
    if (result.rows.length === 0) {
      return null;
    }
    console.log(`✅ Member updated in group ${chatId}: ${userId}`);
    return result.rows[0];
  } catch (error) {
    console.error("❌ Error updating member:", error);
    throw error;
  }
}

/**
 * Elimina (desactiva) un miembro del equipo de un grupo específico.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID de Telegram del usuario
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function removeMember(chatId, userId) {
  const updateQuery = `
    UPDATE team_members
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = $1 AND user_id = $2 AND is_active = true
    RETURNING *;
  `;

  try {
    const result = await query(updateQuery, [chatId, userId]);
    if (result.rows.length === 0) {
      return false;
    }
    console.log(`✅ Member removed from group ${chatId}: ${userId}`);
    return true;
  } catch (error) {
    console.error("❌ Error removing member:", error);
    throw error;
  }
}

/**
 * Genera una descripción del equipo para el prompt de la IA.
 * @param {number|string} chatId - ID del grupo de Telegram
 * @returns {Promise<string>} Descripción del equipo
 */
export async function getTeamDescriptionForPrompt(chatId) {
  const members = await getAllMembers(chatId);

  if (members.length === 0) {
    return "The team is currently empty. Members can be added using the /addMember command.";
  }

  const memberDescriptions = members
    .map((member) => {
      const displayName =
        member.custom_name ||
        member.first_name ||
        member.username ||
        `User ${member.user_id}`;
      const rolePart = member.role ? `Role: ${member.role}` : "";
      const bioPart = member.bio ? `Bio: ${member.bio}` : "";
      const details = [rolePart, bioPart].filter(Boolean).join(". ");

      return `- ${displayName}${details ? `: ${details}` : ""}`;
    })
    .join("\n");

  return `This is your team, your beloved "senpais":\n${memberDescriptions}`;
}

/**
 * Obtiene el nombre para mostrar de un miembro.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID de Telegram del usuario
 * @returns {Promise<string>} Nombre para mostrar
 */
export async function getMemberDisplayName(chatId, userId) {
  const member = await getMemberById(chatId, userId);
  if (!member) {
    return `User ${userId}`;
  }
  return (
    member.custom_name ||
    member.first_name ||
    member.username ||
    `User ${userId}`
  );
}

/**
 * Genera un link de mención de Telegram para un miembro.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID de Telegram del usuario
 * @param {string} [customDisplayName] - Nombre personalizado opcional
 * @returns {Promise<string>} Link de mención HTML
 */
export async function getMemberMentionLink(
  chatId,
  userId,
  customDisplayName = null,
) {
  const displayName =
    customDisplayName || (await getMemberDisplayName(chatId, userId));
  return `<a href="tg://user?id=${userId}">${displayName}</a>`;
}

/**
 * Obtiene estadísticas del equipo de un grupo.
 * @param {number|string} chatId - ID del grupo
 * @returns {Promise<Object>} Estadísticas
 */
export async function getTeamStats(chatId) {
  const statsQuery = `
    SELECT
      COUNT(*) as total_members,
      COUNT(CASE WHEN role IS NOT NULL AND role != 'Team Member' THEN 1 END) as members_with_custom_roles
    FROM team_members
    WHERE chat_id = $1 AND is_active = true;
  `;

  try {
    const result = await query(statsQuery, [chatId]);
    return result.rows[0];
  } catch (error) {
    console.error("❌ Error getting team stats:", error);
    return { total_members: 0, members_with_custom_roles: 0 };
  }
}

/**
 * Busca miembros por nombre o username en un grupo específico.
 * @param {number|string} chatId - ID del grupo
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} Miembros que coinciden
 */
export async function searchMembers(chatId, searchTerm) {
  const searchQuery = `
    SELECT * FROM team_members
    WHERE chat_id = $1 AND is_active = true
    AND (
      username ILIKE $2 OR
      custom_name ILIKE $2 OR
      first_name ILIKE $2 OR
      last_name ILIKE $2
    )
    ORDER BY added_at DESC;
  `;

  try {
    const result = await query(searchQuery, [chatId, `%${searchTerm}%`]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error searching members:", error);
    return [];
  }
}

/**
 * Verifica si un usuario es miembro activo de un grupo.
 * @param {number|string} chatId - ID del grupo
 * @param {number|string} userId - ID del usuario
 * @returns {Promise<boolean>} true si es miembro activo
 */
export async function isMember(chatId, userId) {
  const member = await getMemberById(chatId, userId);
  return member !== null;
}

/**
 * Obtiene todos los grupos en los que un usuario es miembro.
 * @param {number|string} userId - ID del usuario
 * @returns {Promise<Array>} Lista de chat_ids
 */
export async function getUserGroups(userId) {
  const selectQuery = `
    SELECT DISTINCT chat_id FROM team_members
    WHERE user_id = $1 AND is_active = true
    ORDER BY added_at DESC;
  `;

  try {
    const result = await query(selectQuery, [userId]);
    return result.rows.map((row) => row.chat_id);
  } catch (error) {
    console.error("❌ Error getting user groups:", error);
    return [];
  }
}

/**
 * Cuenta el número total de grupos/equipos activos.
 * @returns {Promise<number>} Número de equipos
 */
export async function getTotalTeamsCount() {
  const countQuery = `
    SELECT COUNT(DISTINCT chat_id) as total_teams
    FROM team_members
    WHERE is_active = true;
  `;

  try {
    const result = await query(countQuery);
    return parseInt(result.rows[0].total_teams) || 0;
  } catch (error) {
    console.error("❌ Error counting teams:", error);
    return 0;
  }
}
