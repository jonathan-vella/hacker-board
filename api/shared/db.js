import sql from "mssql";
import { DefaultAzureCredential } from "@azure/identity";

const SQL_SERVER_FQDN = process.env.SQL_SERVER_FQDN;
const SQL_DATABASE_NAME = process.env.SQL_DATABASE_NAME;
const SQL_CONNECTION_STRING = process.env.SQL_CONNECTION_STRING;

let pool;

/**
 * Returns the singleton mssql ConnectionPool.
 * Uses Entra ID token auth in Azure; falls back to SQL_CONNECTION_STRING for local dev.
 */
export async function getPool() {
  if (pool) return pool;

  let config;

  if (SQL_CONNECTION_STRING) {
    // Local dev: explicit connection string (e.g. SQL Server in Docker)
    config = { connectionString: SQL_CONNECTION_STRING };
  } else {
    // Azure: acquire Entra ID access token for Azure SQL scope
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken(
      "https://database.windows.net/.default",
    );

    config = {
      server: SQL_SERVER_FQDN,
      database: SQL_DATABASE_NAME,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
      authentication: {
        type: "azure-active-directory-access-token",
        options: {
          token: tokenResponse.token,
        },
      },
    };
  }

  pool = await sql.connect(config);
  return pool;
}

/**
 * Executes a parameterized SQL query.
 * @param {string} sqlText - SQL query text with named parameters (e.g. @paramName)
 * @param {Object} params - key/value pairs; each value can be a scalar or {type, value}
 * @returns {Promise<import('mssql').IResult<any>>}
 */
export async function query(sqlText, params = {}) {
  const p = await getPool();
  const request = p.request();

  for (const [key, val] of Object.entries(params)) {
    if (val !== null && typeof val === "object" && "type" in val) {
      request.input(key, val.type, val.value);
    } else {
      request.input(key, val);
    }
  }

  return request.query(sqlText);
}

/**
 * Returns the next globally unique hacker number using the SQL SEQUENCE.
 * Atomic — no ETag retry loop needed.
 * @returns {Promise<number>}
 */
export async function nextHackerNumber() {
  const result = await query(
    "SELECT NEXT VALUE FOR dbo.HackerNumberSequence AS nextNum",
  );
  return result.recordset[0].nextNum;
}
