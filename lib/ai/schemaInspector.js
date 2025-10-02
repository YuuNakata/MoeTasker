// lib/ai/schemaInspector.js

/**
 * Schema Inspector for AI Actions
 * Queries actual database structure to help AI auto-correct schema errors
 *
 * Features:
 * - Real-time schema introspection from PostgreSQL
 * - Error detection and analysis
 * - Smart suggestions for corrections
 * - Schema caching for performance
 */

import { query } from '@/lib/db';

// Cache de esquemas para evitar queries repetitivos
const schemaCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene el esquema completo de una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<Object>} Esquema de la tabla
 */
export async function getTableSchema(tableName) {
  // Check cache first
  const cached = schemaCache.get(tableName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.schema;
  }

  try {
    // Query information_schema for column details
    const result = await query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    if (result.rows.length === 0) {
      return null; // Tabla no existe
    }

    const schema = {
      tableName,
      columns: result.rows.map(row => ({
        name: row.column_name,
        type: row.data_type,
        maxLength: row.character_maximum_length,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        position: row.ordinal_position
      })),
      timestamp: Date.now()
    };

    // Cache the result
    schemaCache.set(tableName, { schema, timestamp: Date.now() });

    return schema;
  } catch (error) {
    console.error(`Error fetching schema for ${tableName}:`, error);
    return null;
  }
}

/**
 * Obtiene esquemas de múltiples tablas
 * @param {Array<string>} tableNames - Array de nombres de tablas
 * @returns {Promise<Object>} Mapa de esquemas
 */
export async function getMultipleTableSchemas(tableNames) {
  const schemas = {};

  for (const tableName of tableNames) {
    schemas[tableName] = await getTableSchema(tableName);
  }

  return schemas;
}

/**
 * Lista todas las tablas disponibles en la base de datos
 * @returns {Promise<Array<string>>} Array de nombres de tablas
 */
export async function listAllTables() {
  try {
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return result.rows.map(row => row.table_name);
  } catch (error) {
    console.error('Error listing tables:', error);
    return [];
  }
}

/**
 * Analiza un error de base de datos y determina si es relacionado con esquema
 * @param {Error} error - Error de PostgreSQL
 * @returns {Object} Análisis del error
 */
export function analyzeDBError(error) {
  const analysis = {
    isSchemaError: false,
    errorType: null,
    tableName: null,
    columnName: null,
    suggestion: null
  };

  if (!error) return analysis;

  const errorMessage = error.message || '';
  const errorCode = error.code;

  // Error: columna no existe
  if (errorCode === '42703' || errorMessage.includes('column') && errorMessage.includes('does not exist')) {
    analysis.isSchemaError = true;
    analysis.errorType = 'COLUMN_NOT_FOUND';

    // Extraer nombre de columna del mensaje de error
    const columnMatch = errorMessage.match(/column "([^"]+)" does not exist/i);
    if (columnMatch) {
      analysis.columnName = columnMatch[1];
    }

    analysis.suggestion = 'Query the table schema to find available columns';
  }

  // Error: tabla no existe
  if (errorCode === '42P01' || errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    analysis.isSchemaError = true;
    analysis.errorType = 'TABLE_NOT_FOUND';

    const tableMatch = errorMessage.match(/relation "([^"]+)" does not exist/i);
    if (tableMatch) {
      analysis.tableName = tableMatch[1];
    }

    analysis.suggestion = 'Check available tables or verify table name spelling';
  }

  // Error: tipo de dato incompatible
  if (errorCode === '42804' || errorMessage.includes('type') && errorMessage.includes('mismatch')) {
    analysis.isSchemaError = true;
    analysis.errorType = 'TYPE_MISMATCH';
    analysis.suggestion = 'Check column data types in schema';
  }

  // Error: violación de constraint
  if (errorCode === '23505' || errorMessage.includes('duplicate key')) {
    analysis.isSchemaError = true;
    analysis.errorType = 'UNIQUE_VIOLATION';
    analysis.suggestion = 'Check unique constraints on the table';
  }

  return analysis;
}

/**
 * Genera un mensaje de feedback para la IA con información del esquema
 * @param {Error} error - Error original
 * @param {string} query - Query que falló
 * @param {Object} context - Contexto de ejecución
 * @returns {Promise<string>} Mensaje de feedback para la IA
 */
export async function generateSchemaFeedback(error, failedQuery, context = {}) {
  const analysis = analyzeDBError(error);

  if (!analysis.isSchemaError) {
    // No es error de esquema, retornar error normal
    return `Database error: ${error.message}`;
  }

  let feedback = `🔍 **Schema Error Detected**: ${analysis.errorType}\n\n`;
  feedback += `**Your Query:**\n${failedQuery}\n\n`;
  feedback += `**Error:** ${error.message}\n\n`;

  // Extraer tabla del query
  const tableMatch = failedQuery.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
  const tableName = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : null;

  if (tableName) {
    // Obtener esquema real de la tabla
    const schema = await getTableSchema(tableName);

    if (schema) {
      feedback += `**Actual Schema for "${tableName}":**\n`;
      feedback += `Columns:\n`;

      schema.columns.forEach(col => {
        feedback += `  • ${col.name}: ${col.type}`;
        if (col.maxLength) feedback += `(${col.maxLength})`;
        if (!col.nullable) feedback += ` NOT NULL`;
        if (col.default) feedback += ` DEFAULT ${col.default}`;
        feedback += `\n`;
      });

      // Si el error fue columna no encontrada, sugerir alternativas
      if (analysis.errorType === 'COLUMN_NOT_FOUND' && analysis.columnName) {
        feedback += `\n**Column "${analysis.columnName}" does not exist.**\n`;

        // Buscar columnas similares
        const similarColumns = findSimilarColumns(analysis.columnName, schema.columns);
        if (similarColumns.length > 0) {
          feedback += `Did you mean: ${similarColumns.map(c => `"${c.name}"`).join(', ')}?\n`;
        }
      }

    } else {
      feedback += `**Table "${tableName}" not found in database.**\n`;

      // Listar tablas disponibles
      const tables = await listAllTables();
      feedback += `\nAvailable tables: ${tables.join(', ')}\n`;
    }
  }

  feedback += `\n**Action Required:** Please rewrite your query using the correct schema above.`;

  return feedback;
}

/**
 * Encuentra columnas con nombres similares (útil para sugerencias)
 * @param {string} searchColumn - Columna buscada
 * @param {Array} availableColumns - Columnas disponibles
 * @returns {Array} Columnas similares ordenadas por similitud
 */
function findSimilarColumns(searchColumn, availableColumns) {
  const search = searchColumn.toLowerCase();

  // Calcular similitud simple (levenshtein simplificado)
  const scored = availableColumns.map(col => ({
    ...col,
    score: calculateSimilarity(search, col.name.toLowerCase())
  }));

  // Filtrar y ordenar por similitud
  return scored
    .filter(col => col.score > 0.4) // Umbral de similitud
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3 sugerencias
}

/**
 * Calcula similitud entre dos strings (0-1)
 */
function calculateSimilarity(str1, str2) {
  // Similitud basada en subsecuencias comunes
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  // Contar caracteres comunes en posiciones similares
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longer.length;
}

/**
 * Genera un prompt con esquemas de tablas para la IA
 * @param {Array<string>} tableNames - Tablas a incluir
 * @returns {Promise<string>} Documentación de esquemas
 */
export async function generateSchemaDocumentation(tableNames) {
  const schemas = await getMultipleTableSchemas(tableNames);

  let doc = `# 📊 Database Schema Documentation\n\n`;
  doc += `Current database structure (auto-generated from actual DB):\n\n`;

  for (const [tableName, schema] of Object.entries(schemas)) {
    if (!schema) {
      doc += `## ⚠️ ${tableName}\nTable not found in database.\n\n`;
      continue;
    }

    doc += `## 📋 ${tableName}\n\n`;
    doc += `**Columns:**\n`;

    schema.columns.forEach(col => {
      doc += `- **${col.name}**: ${col.type}`;
      if (col.maxLength) doc += `(${col.maxLength})`;
      if (!col.nullable) doc += ` *[REQUIRED]*`;
      if (col.default) doc += ` (default: ${col.default})`;
      doc += `\n`;
    });

    doc += `\n`;
  }

  return doc;
}

/**
 * Limpia el cache de esquemas (útil para testing o después de cambios de BD)
 */
export function clearSchemaCache() {
  schemaCache.clear();
  console.log('✅ Schema cache cleared');
}

/**
 * Health check del schema inspector
 */
export async function healthCheck() {
  try {
    const tables = await listAllTables();
    const testTable = tables[0];
    const schema = testTable ? await getTableSchema(testTable) : null;

    return {
      status: 'healthy',
      tablesFound: tables.length,
      cacheSize: schemaCache.size,
      testQuery: schema ? 'success' : 'no tables',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  getTableSchema,
  getMultipleTableSchemas,
  listAllTables,
  analyzeDBError,
  generateSchemaFeedback,
  generateSchemaDocumentation,
  clearSchemaCache,
  healthCheck
};
