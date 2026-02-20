#!/usr/bin/env node

/**
 * Deploy the HackerBoard Azure SQL schema and grant the SWA managed identity
 * db_owner access so the API can connect without a password.
 *
 * Reads api/schema/init.sql and executes it against the target Azure SQL database.
 * Uses Entra ID (DefaultAzureCredential) — no passwords required.
 *
 * Usage:
 *   node scripts/deploy-schema.js
 *   SQL_SERVER_FQDN=<fqdn> SQL_DATABASE_NAME=<db> SWA_NAME=<swa> node scripts/deploy-schema.js
 *
 * Required environment variables:
 *   SQL_SERVER_FQDN      — e.g. my-server.database.windows.net
 *   SQL_DATABASE_NAME    — e.g. hacker-board-db
 *
 * Optional:
 *   SWA_NAME             — Static Web App resource name; when set, grants the SWA
 *                          system-assigned managed identity the db_owner role.
 *   SQL_CONNECTION_STRING — full mssql connection string (bypasses Entra ID, local dev)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import sql from "mssql";
import { DefaultAzureCredential } from "@azure/identity";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "..", "api", "schema", "init.sql");

const SQL_SERVER_FQDN = process.env.SQL_SERVER_FQDN;
const SQL_DATABASE_NAME = process.env.SQL_DATABASE_NAME;
const SQL_CONNECTION_STRING = process.env.SQL_CONNECTION_STRING;
const SWA_NAME = process.env.SWA_NAME;

async function buildConfig() {
  if (SQL_CONNECTION_STRING) {
    return { connectionString: SQL_CONNECTION_STRING };
  }

  if (!SQL_SERVER_FQDN || !SQL_DATABASE_NAME) {
    console.error(
      "❌  Missing required env vars: SQL_SERVER_FQDN and SQL_DATABASE_NAME",
    );
    console.error(
      "     Set them or provide SQL_CONNECTION_STRING for local dev.",
    );
    process.exit(1);
  }

  console.log("  Acquiring Entra ID token for Azure SQL...");
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken(
    "https://database.windows.net/.default",
  );

  return {
    server: SQL_SERVER_FQDN,
    database: SQL_DATABASE_NAME,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token: tokenResponse.token },
    },
  };
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  HackerBoard — SQL Schema Deployment     ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  console.log(`  Schema file: ${SCHEMA_PATH}`);
  const ddl = readFileSync(SCHEMA_PATH, "utf8");
  console.log(
    `  DDL size: ${(ddl.length / 1024).toFixed(1)} KB (${ddl.split("\n").length} lines)`,
  );

  console.log("");
  console.log("📡 Connecting to Azure SQL...");
  const config = await buildConfig();

  const pool = await sql.connect(config);
  console.log(`  ✅ Connected to ${SQL_SERVER_FQDN ?? "local"}`);

  // T-SQL files use GO as a batch separator — split on GO at the start of a line
  const batches = ddl
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  console.log(`\n📋 Executing ${batches.length} SQL batches...`);

  for (let i = 0; i < batches.length; i++) {
    const label = batches[i].slice(0, 60).replace(/\n/g, " ");
    try {
      await pool.request().query(batches[i]);
      console.log(`  ✅ Batch ${i + 1}/${batches.length}: ${label}...`);
    } catch (err) {
      console.error(`  ❌ Batch ${i + 1} failed: ${err.message}`);
      console.error(`     SQL: ${label}`);
      await pool.close();
      process.exit(1);
    }
  }

  // Grant the SWA managed identity db_owner so the API can authenticate
  // via its system-assigned identity without a connection string or password.
  if (SWA_NAME) {
    console.log("");
    console.log("🔐 Granting db_owner to SWA managed identity...");
    try {
      await pool.request().query(`IF NOT EXISTS (
  SELECT 1 FROM sys.database_principals WHERE name = '${SWA_NAME}'
)
BEGIN
  CREATE USER [${SWA_NAME}] FROM EXTERNAL PROVIDER
END;
ALTER ROLE db_owner ADD MEMBER [${SWA_NAME}];`);
      console.log(`  ✅ db_owner granted to [${SWA_NAME}]`);
    } catch (err) {
      // Non-fatal: the SWA identity may not have propagated yet.
      // The operator can re-run or grant manually.
      console.warn(
        `  ⚠️  Could not grant db_owner to [${SWA_NAME}]: ${err.message}`,
      );
      console.warn(
        "     Re-run deploy-schema.js with SWA_NAME once the SWA is fully provisioned.",
      );
    }
  }

  await pool.close();

  console.log("");
  console.log("✅ Schema deployment complete.");
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
