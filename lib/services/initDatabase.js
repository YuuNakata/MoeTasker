// lib/services/initDatabase.js
import { query } from "@/lib/db";
import { initializeMembersTable } from "./memberService";

export async function initializeDatabase() {
  console.log("🚀 Starting database initialization...");

  try {
    await initializeMembersTable();
    console.log("✅ Database initialization completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Fatal error during database initialization:", error);
    throw error;
  }
}

export async function checkDatabaseHealth() {
  const tables = ['team_members', 'tasks'];
  const health = {
    status: 'healthy',
    tables: {},
    timestamp: new Date().toISOString()
  };

  for (const table of tables) {
    try {
      const result = await query(`SELECT COUNT(*) as count FROM ${table};`);
      health.tables[table] = {
        exists: true,
        rowCount: parseInt(result.rows[0].count)
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.tables[table] = {
        exists: false,
        error: error.message
      };
    }
  }

  return health;
}
