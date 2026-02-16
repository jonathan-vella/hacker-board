const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME;
const credential = new DefaultAzureCredential();

function getTableClient(tableName) {
  const url = `https://${STORAGE_ACCOUNT}.table.core.windows.net`;
  return new TableClient(url, tableName, credential);
}

module.exports = { getTableClient };
