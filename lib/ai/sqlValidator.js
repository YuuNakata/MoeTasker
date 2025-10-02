// lib/ai/sqlValidator.js

/**
 * SQL Validator & Sanitizer
 * Valida y sanitiza queries SQL para prevenir inyección y acceso no autorizado
 *
 * Seguridad:
 * - Whitelist de tablas permitidas
 * - Blacklist de operaciones peligrosas
 * - Validación de queries parametrizadas
 * - Límites de resultados
 * - Enforcement de multi-tenancy (chat_id)
 */

// Tablas permitidas para acceso de IA
const ALLOWED_TABLES = [
  "tasks",
  "team_members",
  "oracle_memories",
  "stickers",
  "work_documents",
  "group_config",
  "ai_memory", // Tabla especial para memoria de IA
];

// Operaciones SQL permitidas
const ALLOWED_OPERATIONS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

// Palabras clave peligrosas que NO deben aparecer
const DANGEROUS_KEYWORDS = [
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "SCRIPT",
  "--",
  ";--",
  "/*",
  "*/",
  "xp_",
  "sp_",
  "UNION",
  "INFORMATION_SCHEMA",
  "pg_",
];

// Límites de seguridad
const SECURITY_LIMITS = {
  MAX_RESULTS: 100, // Máximo de rows que puede retornar un SELECT
  MAX_AFFECTED_ROWS: 50, // Máximo de rows que puede afectar UPDATE/DELETE
  QUERY_TIMEOUT: 5000, // Timeout en ms
};

/**
 * Valida un query SQL completo
 * @param {string} query - Query SQL a validar
 * @param {Array} params - Parámetros para el query
 * @param {Object} context - Contexto de ejecución (chat_id, user_id, etc)
 * @returns {Object} - { valid: boolean, error: string|null, sanitized: Object }
 */
export function validateSQLQuery(query, params = [], context = {}) {
  if (!query || typeof query !== "string") {
    return {
      valid: false,
      error: "Query must be a non-empty string",
    };
  }

  const normalizedQuery = query.trim().toUpperCase();

  // 1. Validar que no esté vacío
  if (normalizedQuery.length === 0) {
    return {
      valid: false,
      error: "Query cannot be empty",
    };
  }

  // 2. Detectar operación principal
  const operation = detectOperation(normalizedQuery);
  if (!operation) {
    return {
      valid: false,
      error: "Could not detect SQL operation (SELECT, INSERT, UPDATE, DELETE)",
    };
  }

  if (!ALLOWED_OPERATIONS.includes(operation)) {
    return {
      valid: false,
      error: `Operation ${operation} is not allowed. Allowed: ${ALLOWED_OPERATIONS.join(", ")}`,
    };
  }

  // 3. Buscar palabras clave peligrosas
  const dangerousCheck = checkDangerousKeywords(normalizedQuery);
  if (!dangerousCheck.safe) {
    return {
      valid: false,
      error: `Dangerous keyword detected: ${dangerousCheck.keyword}`,
    };
  }

  // 4. Extraer y validar tablas
  const tables = extractTables(normalizedQuery);
  const tableValidation = validateTables(tables);
  if (!tableValidation.valid) {
    return {
      valid: false,
      error: tableValidation.error,
    };
  }

  // 5. Validar que use parámetros en lugar de valores concatenados (básico)
  const paramCheck = checkParameterUsage(query, params);
  if (!paramCheck.valid) {
    return {
      valid: false,
      error: paramCheck.error,
    };
  }

  // 6. Validar multi-tenancy: queries deben incluir chat_id cuando aplique
  const multiTenancyCheck = validateMultiTenancy(
    normalizedQuery,
    tables,
    context,
  );
  if (!multiTenancyCheck.valid) {
    return {
      valid: false,
      error: multiTenancyCheck.error,
      warning: multiTenancyCheck.warning,
    };
  }

  // 7. Agregar límites automáticos para SELECTs
  let sanitizedQuery = query.trim();
  if (operation === "SELECT" && !normalizedQuery.includes("LIMIT")) {
    sanitizedQuery += ` LIMIT ${SECURITY_LIMITS.MAX_RESULTS}`;
  }

  return {
    valid: true,
    error: null,
    sanitized: {
      query: sanitizedQuery,
      params,
      operation,
      tables,
      limits: SECURITY_LIMITS,
    },
  };
}

/**
 * Detecta la operación SQL principal
 */
function detectOperation(normalizedQuery) {
  for (const op of ALLOWED_OPERATIONS) {
    if (normalizedQuery.startsWith(op)) {
      return op;
    }
  }
  return null;
}

/**
 * Verifica palabras clave peligrosas
 */
function checkDangerousKeywords(normalizedQuery) {
  for (const keyword of DANGEROUS_KEYWORDS) {
    // Use word boundaries to match whole words only, not substrings
    // Special handling for operators like --, /*, */
    const isOperator = ["--", ";--", "/*", "*/"].includes(keyword);

    if (isOperator) {
      // For operators, use direct string match
      if (normalizedQuery.includes(keyword)) {
        return {
          safe: false,
          keyword,
        };
      }
    } else {
      // For keywords, match whole words only
      const regex = new RegExp(`\\b${keyword.toUpperCase()}\\b`);
      if (regex.test(normalizedQuery)) {
        return {
          safe: false,
          keyword,
        };
      }
    }
  }
  return { safe: true };
}

/**
 * Extrae nombres de tablas del query
 * Nota: Esta es una implementación básica. Para producción considerar un parser SQL completo.
 */
function extractTables(normalizedQuery) {
  const tables = [];

  // Buscar después de FROM
  const fromMatch = normalizedQuery.match(/FROM\s+(\w+)/);
  if (fromMatch) {
    tables.push(fromMatch[1].toLowerCase());
  }

  // Buscar después de JOIN
  const joinMatches = normalizedQuery.matchAll(/JOIN\s+(\w+)/g);
  for (const match of joinMatches) {
    tables.push(match[1].toLowerCase());
  }

  // Buscar después de INSERT INTO
  const insertMatch = normalizedQuery.match(/INSERT\s+INTO\s+(\w+)/);
  if (insertMatch) {
    tables.push(insertMatch[1].toLowerCase());
  }

  // Buscar después de UPDATE
  const updateMatch = normalizedQuery.match(/UPDATE\s+(\w+)/);
  if (updateMatch) {
    tables.push(updateMatch[1].toLowerCase());
  }

  // Buscar después de DELETE FROM
  const deleteMatch = normalizedQuery.match(/DELETE\s+FROM\s+(\w+)/);
  if (deleteMatch) {
    tables.push(deleteMatch[1].toLowerCase());
  }

  return [...new Set(tables)]; // Eliminar duplicados
}

/**
 * Valida que las tablas estén en la whitelist
 */
function validateTables(tables) {
  if (tables.length === 0) {
    return {
      valid: false,
      error: "No tables detected in query",
    };
  }

  for (const table of tables) {
    if (!ALLOWED_TABLES.includes(table)) {
      return {
        valid: false,
        error: `Table '${table}' is not in whitelist. Allowed: ${ALLOWED_TABLES.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Valida uso de parámetros parametrizados
 */
function checkParameterUsage(query, params) {
  // Contar placeholders ($1, $2, etc)
  const placeholders = query.match(/\$\d+/g) || [];
  const uniquePlaceholders = new Set(placeholders);

  // Verificar que el número de parámetros coincida
  if (params && params.length > 0) {
    if (uniquePlaceholders.size !== params.length) {
      return {
        valid: false,
        error: `Parameter count mismatch: query has ${uniquePlaceholders.size} placeholders but ${params.length} params provided`,
      };
    }
  }

  // Advertencia: buscar posibles valores concatenados (básico)
  // Esto no es perfecto pero ayuda a detectar algunos casos
  const suspiciousPatterns = [
    /'\s*\+\s*'/, // ' + '
    /"\s*\+\s*"/, // " + "
    /'\s*\|\|\s*'/, // ' || ' (concatenación en SQL)
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(query)) {
      return {
        valid: false,
        error:
          "Possible string concatenation detected. Use parameterized queries ($1, $2, etc.)",
      };
    }
  }

  return { valid: true };
}

/**
 * Valida que el query respete multi-tenancy (chat_id filtering)
 */
function validateMultiTenancy(normalizedQuery, tables, context) {
  // Tablas que DEBEN tener filtro por chat_id
  const multiTenantTables = [
    "tasks",
    "team_members",
    "oracle_memories",
    "group_config",
    "ai_memory",
  ];

  const requiresChatId = tables.some((table) =>
    multiTenantTables.includes(table),
  );

  if (requiresChatId) {
    // Verificar que la query incluya chat_id
    if (!normalizedQuery.includes("CHAT_ID")) {
      return {
        valid: false,
        error: "Multi-tenant tables require chat_id filtering",
        warning: `Tables ${tables.join(", ")} require WHERE chat_id = $n clause`,
      };
    }

    // Verificar que tengamos el chat_id en el contexto
    if (!context.chat_id && !context.chatId) {
      return {
        valid: false,
        error: "chat_id not provided in context but required for this query",
      };
    }
  }

  return { valid: true };
}

/**
 * Sanitiza parámetros para prevenir inyección
 */
export function sanitizeParams(params) {
  // Convert array-like objects to arrays
  let paramsArray;

  if (Array.isArray(params)) {
    paramsArray = params;
  } else if (params && typeof params === "object") {
    // Check if it's an array-like object (has numeric keys)
    const keys = Object.keys(params);
    const isArrayLike =
      keys.length > 0 && keys.every((key) => /^\d+$/.test(key));

    if (isArrayLike) {
      // Convert to array by sorting keys numerically
      paramsArray = keys
        .map((k) => parseInt(k))
        .sort((a, b) => a - b)
        .map((i) => params[i]);
    } else {
      return [];
    }
  } else {
    return [];
  }

  return paramsArray.map((param) => {
    // Si es string, hacer sanitización básica
    if (typeof param === "string") {
      // Remover null bytes
      let sanitized = param.replace(/\0/g, "");

      // Limitar longitud
      if (sanitized.length > 1000) {
        sanitized = sanitized.substring(0, 1000);
      }

      return sanitized;
    }

    // Números, booleanos, null, etc. pasan directo
    return param;
  });
}

/**
 * Valida límites de resultados después de la ejecución
 */
export function validateResultLimits(result, operation) {
  if (!result) return { valid: true };

  if (operation === "SELECT") {
    if (result.rows && result.rows.length > SECURITY_LIMITS.MAX_RESULTS) {
      return {
        valid: false,
        error: `Query returned ${result.rows.length} rows, exceeds limit of ${SECURITY_LIMITS.MAX_RESULTS}`,
      };
    }
  }

  if (["UPDATE", "DELETE"].includes(operation)) {
    if (result.rowCount > SECURITY_LIMITS.MAX_AFFECTED_ROWS) {
      return {
        valid: false,
        error: `Query affected ${result.rowCount} rows, exceeds limit of ${SECURITY_LIMITS.MAX_AFFECTED_ROWS}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Genera un query seguro con los límites aplicados
 */
export function generateSafeQuery(query, params, context) {
  const validation = validateSQLQuery(query, params, context);

  if (!validation.valid) {
    throw new Error(`SQL Validation failed: ${validation.error}`);
  }

  return validation.sanitized;
}

/**
 * Verifica si una tabla es accesible por la IA
 */
export function isTableAllowed(tableName) {
  return ALLOWED_TABLES.includes(tableName.toLowerCase());
}

/**
 * Retorna información de configuración para la IA
 */
export function getAISecurityInfo() {
  return {
    allowedTables: ALLOWED_TABLES,
    allowedOperations: ALLOWED_OPERATIONS,
    limits: SECURITY_LIMITS,
    requiresMultiTenancy: true,
    parameterFormat: "PostgreSQL ($1, $2, ...)",
  };
}

export default {
  validateSQLQuery,
  sanitizeParams,
  validateResultLimits,
  generateSafeQuery,
  isTableAllowed,
  getAISecurityInfo,
  ALLOWED_TABLES,
  ALLOWED_OPERATIONS,
  SECURITY_LIMITS,
};
