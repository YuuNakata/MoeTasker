const { query } = require('../db');

class StickerManager {

  /**
   * Agrega un nuevo sticker a la base de datos.
   * @param {string} fileId - El file_id del sticker de Telegram.
   * @param {string[]} categories - Un array de categorías que describen el sticker.
   * @param {number} userId - El ID del usuario que agrega el sticker.
   * @returns {Promise<object>} El sticker guardado.
   */
  static async addSticker(fileId, categories, userId) {
    const sql = `
      INSERT INTO stickers (file_id, categories, added_by_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (file_id) DO UPDATE SET
        categories = EXCLUDED.categories,
        added_by_user_id = EXCLUDED.added_by_user_id
      RETURNING *;
    `;
    try {
      const result = await query(sql, [fileId, categories, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error al guardar el sticker en la base de datos:', error);
      throw error;
    }
  }

  /**
   * Busca un sticker aleatorio que coincida con al menos una de las categorías proporcionadas.
   * @param {string[]} categories - Un array de categorías para buscar.
   * @returns {Promise<object|null>} Un objeto de sticker o null si no se encuentra ninguno.
   */
  static async findRandomStickerByCategories(categories) {
    if (!categories || categories.length === 0) {
      return null;
    }

    const sql = `
      SELECT file_id
      FROM stickers
      WHERE categories && $1::text[] -- El operador && comprueba si hay superposición entre arrays
      ORDER BY RANDOM()
      LIMIT 1;
    `;

    try {
      const result = await query(sql, [categories]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error al buscar sticker por categorías:', error);
      throw error;
    }
  }
}

module.exports = StickerManager;
