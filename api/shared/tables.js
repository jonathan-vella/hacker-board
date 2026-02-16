import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

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

const ensuredTables = new Set();

export function getTableClient(tableName) {
  const connStr = resolveConnectionString();
  let client;
  if (connStr) {
    client = TableClient.fromConnectionString(connStr, tableName, {
      allowInsecureConnection: true,
    });
  } else {
    if (!credential) {
      credential = new DefaultAzureCredential();
    }
    const url = `https://${STORAGE_ACCOUNT}.table.core.windows.net`;
    client = new TableClient(url, tableName, credential);
  }
  return client;
}

export async function ensureTable(tableName) {
  if (ensuredTables.has(tableName)) return;
  const client = getTableClient(tableName);
  await client.createTable();
  ensuredTables.add(tableName);
}
