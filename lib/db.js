// lib/db.js
import { Pool } from 'pg';

dotenv.config(); // Asegurar que las variables de entorno estén cargadas

let pool;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definida en las variables de entorno.');
  }
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Opciones adicionales si tu proveedor de DB las requiere (ej: SSL)
    // ssl: {
    //   rejectUnauthorized: false // Necesario para algunos proveedores como Heroku, Neon
    // }
  });

  pool.on('connect', () => {
    console.log('DB: Conectado exitosamente a PostgreSQL.');
  });

  pool.on('error', (err) => {
    console.error('DB Error: Error inesperado en el cliente del pool de PostgreSQL.', err);
    // Podrías querer terminar el proceso si la conexión es crítica y falla persistentemente
    // process.exit(-1);
  });

  // Probar la conexión una vez al iniciar (opcional pero útil)
  // pool.query('SELECT NOW()', (err, res) => {
  //   if (err) {
  //     console.error('DB Test Error: Fallo al ejecutar query de prueba.', err);
  //   } else {
  //     console.log('DB Test Success: Query de prueba ejecutada. Hora del servidor DB:', res.rows[0].now);
  //   }
  // });

} catch (error) {
  console.error("DB Init Error: No se pudo inicializar el pool de PostgreSQL.", error);
  // Si no se puede crear el pool, las operaciones de DB fallarán.
  // Podrías querer que la aplicación no inicie o maneje esto de alguna forma.
  pool = null; // Para que las funciones que lo usan puedan verificar
}


// Exportar una función para ejecutar queries
export async function query(text, params) {
  if (!pool) {
    console.error("DB Query Error: El pool de PostgreSQL no está inicializado.");
    throw new Error("El pool de la base de datos no está disponible.");
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('DB Query Executed:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('DB Query Error:', { text, error });
    throw error; // Relanzar el error para que el llamador lo maneje
  }
}

// Opcional: exportar el pool directamente si necesitas transacciones más complejas
// export { pool };