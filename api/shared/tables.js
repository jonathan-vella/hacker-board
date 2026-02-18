import { TableClient } from "@azure/data-tables";
import {
  ManagedIdentityCredential,
  DefaultAzureCredential,
} from "@azure/identity";

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME;
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const WEBJOBS_STORAGE = process.env.AzureWebJobsStorage;

const AZURITE_CONNECTION_STRING =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1";

let credential;

function resolveConnectionString() {
  if (CONNECTION_STRING) return CONNECTION_STRING;
  if (WEBJOBS_STORAGE === "UseDevelopmentStorage=true") {
    return AZURITE_CONNECTION_STRING;
  }
  return undefined;
}

// SWA managed functions don't expose IDENTITY_ENDPOINT/MSI_ENDPOINT,
// so DefaultAzureCredential's chain fails. Use ManagedIdentityCredential
// directly when a client ID is provided, falling back to DefaultAzureCredential
// for local dev.
function resolveCredential() {
  if (credential) return credential;
  const clientId = process.env.AZURE_CLIENT_ID;
  if (clientId) {
    credential = new ManagedIdentityCredential(clientId);
  } else {
    credential = new DefaultAzureCredential();
  }
  return credential;
}

const ensuredTables = new Set();

export function getTableClient(tableName) {
  const connStr = resolveConnectionString();
  let client;
  if (connStr) {
    client = TableClient.fromConnectionString(connStr, tableName, {
      allowInsecureConnection: true,
    });
  } else {
    const cred = resolveCredential();
    const url = `https://${STORAGE_ACCOUNT}.table.core.windows.net`;
    client = new TableClient(url, tableName, cred);
  }
  return client;
}

export async function ensureTable(tableName) {
  if (ensuredTables.has(tableName)) return;
  const client = getTableClient(tableName);
  await client.createTable();
  ensuredTables.add(tableName);
}

/**
 * Atomically increments the global hacker counter and returns the next value.
 * Uses optimistic concurrency (ETag) on the Attendees table sentinel row.
 */
export async function nextHackerNumber() {
  const client = getTableClient("Attendees");
  const PARTITION = "_meta";
  const ROW = "counter";
  const MAX_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let current;
    try {
      current = await client.getEntity(PARTITION, ROW);
    } catch (err) {
      if (err.statusCode !== 404) throw err;
      // First ever registration — seed the counter row
      try {
        await client.createEntity({
          partitionKey: PARTITION,
          rowKey: ROW,
          value: 1,
        });
        return 1;
      } catch (createErr) {
        // Another request raced us, retry from the top
        if (createErr.statusCode === 409) continue;
        throw createErr;
      }
    }

    const next = (current.value || 0) + 1;
    try {
      await client.updateEntity(
        {
          partitionKey: PARTITION,
          rowKey: ROW,
          value: next,
        },
        "Replace",
        { ifMatch: current.etag },
      );
      return next;
    } catch (updateErr) {
      // ETag mismatch — another request incremented first, retry
      if (updateErr.statusCode === 412) continue;
      throw updateErr;
    }
  }

  throw new Error("Failed to acquire hacker counter after max retries");
}
