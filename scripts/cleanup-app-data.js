#!/usr/bin/env node

/**
 * Purge all application data from Azure Table Storage.
 *
 * Usage:
 *   node scripts/cleanup-app-data.js              # Dry run (shows what would be deleted)
 *   node scripts/cleanup-app-data.js --confirm     # Actually deletes data
 *   node scripts/cleanup-app-data.js --tables Teams,Scores  # Only specific tables
 *
 * Environment:
 *   AZURE_STORAGE_CONNECTION_STRING — Required (falls back to Azurite default)
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { TableClient, TableServiceClient } = require("@azure/data-tables");

const AZURITE_CONNECTION = "UseDevelopmentStorage=true";

const ALL_TABLES = [
  "Teams",
  "Scores",
  "Attendees",
  "Submissions",
  "Awards",
  "Rubrics",
  "Config",
];

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const tablesFlag = args.find((a) => a.startsWith("--tables="));
  const tables = tablesFlag
    ? tablesFlag
        .replace("--tables=", "")
        .split(",")
        .map((t) => t.trim())
    : ALL_TABLES;

  const connectionString =
    process.env.AZURE_STORAGE_CONNECTION_STRING || AZURITE_CONNECTION;

  console.log(`Mode: ${confirm ? "DELETE" : "DRY RUN"}`);
  console.log(`Tables: ${tables.join(", ")}`);
  console.log(
    `Connection: ${connectionString === AZURITE_CONNECTION ? "Azurite (local)" : "Azure"}\n`,
  );

  if (!confirm) {
    console.log(
      "⚠️  This is a DRY RUN. Add --confirm to actually delete data.\n",
    );
  }

  let totalEntities = 0;

  for (const tableName of tables) {
    try {
      const client = TableClient.fromConnectionString(
        connectionString,
        tableName,
      );
      let count = 0;

      for await (const entity of client.listEntities()) {
        count++;
        if (confirm) {
          await client.deleteEntity(entity.partitionKey, entity.rowKey);
        }
      }

      totalEntities += count;
      const action = confirm ? "Deleted" : "Would delete";
      console.log(`  ${action} ${count} entities from ${tableName}`);
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(`  Table ${tableName} does not exist — skipped`);
      } else {
        console.error(`  Error on ${tableName}: ${err.message}`);
      }
    }
  }

  console.log(
    `\nTotal: ${totalEntities} entities ${confirm ? "deleted" : "found"}`,
  );

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
