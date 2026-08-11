import { promises as fs } from "node:fs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) {
  console.error("Migration blocked: set DATABASE_DIRECT_URL or DATABASE_URL to a PostgreSQL connection string.");
  process.exitCode = 1;
} else {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

  const client = await pool.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS andrew_social");
    await client.query(`
      CREATE TABLE IF NOT EXISTS andrew_social.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsUrl = new URL("../migrations/", import.meta.url);
    const files = (await fs.readdir(migrationsUrl))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b, "en"));

    for (const file of files) {
      const exists = await client.query(
        "SELECT 1 FROM andrew_social.schema_migrations WHERE version = $1",
        [file],
      );
      if (exists.rowCount) {
        console.info(`migration already applied: ${file}`);
        continue;
      }

      const sql = await fs.readFile(new URL(file, migrationsUrl), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO andrew_social.schema_migrations (version) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.info(`migration applied: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } catch (error) {
    console.error("Migration failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
