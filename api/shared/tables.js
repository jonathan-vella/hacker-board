import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME;
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

let credential;

export function getTableClient(tableName) {
  if (CONNECTION_STRING) {
    return TableClient.fromConnectionString(CONNECTION_STRING, tableName);
  }
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  const url = `https://${STORAGE_ACCOUNT}.table.core.windows.net`;
  return new TableClient(url, tableName, credential);
}
