#!/usr/bin/env node

/**
 * Purge all application data from Azure SQL.
 *
 * Usage:
 *   node scripts/cleanup-app-data.js              # Dry run (counts only)
 *   node scripts/cleanup-app-data.js --confirm     # Actually deletes data
 *   node scripts/cleanup-app-data.js --tables Teams,Scores  # Only specific tables
 *
 * Required environment variables:
 *   SQL_SERVER_FQDN      — Azure SQL server FQDN
 *   SQL_DATABASE_NAME    — Azure SQL database name
 *
 * Optional (local dev override):
 *   SQL_CONNECTION_STRING — full mssql connection string
 */

import { parseArgs } from "node:util";
import sql from "mssql";
import { DefaultAzureCredential } from "@azure/identity";

const SQL_SERVER_FQDN = process.env.SQL_SERVER_FQDN;
const SQL_DATABASE_NAME = process.env.SQL_DATABASE_NAME;
const SQL_CONNECTION_STRING = process.env.SQL_CONNECTION_STRING;

// Delete order respects FK constraints (children before parents)
const ALL_TABLES = ["Scores", "Awards", "Submissions", "Attendees", "Teams", "Rubrics", "Config"];

async function buildConfig() {
  if (SQL_CONNECTION_STRING) {
    return { connectionString: SQL_CONNECTION_STRING };
  }

  if (!SQL_SERVER_FQDN || !SQL_DATABASE_NAME) {
    console.error("❌  Missing required env vars: SQL_SERVER_FQDN and SQL_DATABASE_NAME");
    process.exit(1);
  }

  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken("https://database.windows.net/.default");

  return {
    server: SQL_SERVER_FQDN,
    database: SQL_DATABASE_NAME,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token: tokenResponse.token },
    },
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const confirm = argv.includes("--confirm");
  const tablesFlag = argv.find((a) => a.startsWith("--tables="));
  const tables = tablesFlag
    ? tablesFlag.replace("--tables=", "").split(",").map((t) => t.trim())
    : ALL_TABLES;

  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  HackerBoard — SQL Data Cleanup          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  Mode:   ${confirm ? "DELETE" : "DRY RUN"}`);
  console.log(`  Tables: ${tables.join(", ")}`);
  console.log(`  Target: ${SQL_SERVER_FQDN ?? "local"}`);
  console.log("");

  if (!confirm) {
    console.log("⚠️  This is a DRY RUN. Add --confirm to actually delete data.\n");
  }

  const config = await buildConfig();
  const pool = await sql.connect(config);

  let totalRows = 0;

  for (const tableName of tables) {
    try {
      const countResult = await pool
        .request()
        .query(`SELECT COUNT(*) AS cnt FROM dbo.${tableName}`);
      const count = countResult.recordset[0].cnt;
      totalRows += count;

      if (confirm && count > 0) {
        await pool.request().query(`DELETE FROM dbo.${tableName}`);
        console.log(`  ✅ Deleted ${count} rows from ${tableName}`);
      } else {
        console.log(`  ${confirm ? "⏭️  Skipped (empty)" : "Would delete"} ${count} rows from ${tableName}`);
      }
    } catch (err) {
      console.error(`  ❌ Error on ${tableName}: ${err.message}`);
    }
  }

  if (confirm && tables.includes("Attendees")) {
    // Reset the hacker number sequence after wiping attendees
    try {
      await pool.request().query(
        "ALTER SEQUENCE dbo.HackerNumberSequence RESTART WITH 1",
      );
      console.log("  ✅ HackerNumberSequence reset to 1");
    } catch (err) {
      console.warn(`  ⚠️  Could not reset sequence: ${err.message}`);
    }
  }

  await pool.close();

  console.log(`\nTotal: ${totalRows} rows ${confirm ? "deleted" : "found"}`);

  if (confirm) {
    console.log("\n✅ Cleanup complete.");
  } else {
    console.log("\nRun with --confirm to execute deletion.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
