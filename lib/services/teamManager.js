// lib/services/teamManager.js
import teamData from '../data/team-data.json';

/**
 * Este módulo centraliza la gestión de la información del equipo.
 * Combina los datos de un archivo JSON con los IDs de las variables de entorno.
 */

const team = Object.keys(teamData).map(key => {
    const id = process.env[`USER_ID_${key}`];
    const memberInfo = teamData[key];
    return {
        id: String(id), // Aseguramos que el ID sea un string para comparaciones
        name: memberInfo.displayName,
        role: memberInfo.role,
        bio: memberInfo.bio // Añadimos la nueva información de la biografía
    };
}).filter(member => member.id && member.id !== 'undefined'); // Filtramos si falta un ID

/**
 * Devuelve la lista completa de miembros del equipo.
 * @returns {Array<Object>} Lista de miembros con id, name y role.
 */
export function getTeamMembers() {
    return team;
}

/**
 * Busca a un miembro del equipo por su ID de Telegram.
 * @param {string | number} id El ID de Telegram del usuario.
 * @returns {Object | undefined} El objeto del miembro del equipo o undefined si no se encuentra.
 */
export function getMemberById(id) {
    return team.find(member => member.id === String(id));
}

/**
 * Genera una descripción en texto plano del equipo para inyectar en el prompt de la IA.
 * @returns {string} Una cadena de texto describiendo al equipo.
 */
export function getTeamDescriptionForPrompt() {
    if (team.length === 0) {
        return "Aún no conozco a los miembros del equipo, ¡pero me encantaría hacerlo! Por favor, configura las variables de entorno USER_ID_* y el archivo team-data.json.";
    }

    const memberDescriptions = team.map(member => 
        `- ${member.name}: Es nuestro/a ${member.role}. ${member.bio || ''}` // Añadimos la bio a la descripción
    ).join('\n');

    return `Este es tu equipo, tus queridos "senpais":\n${memberDescriptions}`;
}
