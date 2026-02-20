import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;

let client;
let database;

function getClient() {
  if (client) return client;

  client = new CosmosClient({
    endpoint: COSMOS_ENDPOINT,
    aadCredentials: new DefaultAzureCredential(),
  });
  return client;
}

export function getDatabase() {
  if (database) return database;
  database = getClient().database("hackerboard");
  return database;
}

export function getContainer(name) {
  return getDatabase().container(name);
}

/**
 * Returns the next globally unique hacker number using optimistic concurrency
 * on a counter document in the config container.
 */
export async function nextHackerNumber() {
  const container = getContainer("config");
  const counterId = "hackerNumberCounter";

  // Retry loop for ETag-based optimistic concurrency
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const { resource, headers } = await container
        .item(counterId, counterId)
        .read();

      if (resource) {
        const nextNum = (resource.currentValue || 0) + 1;
        await container
          .item(counterId, counterId)
          .replace(
            { ...resource, currentValue: nextNum },
            { accessCondition: { type: "IfMatch", condition: resource._etag } },
          );
        return nextNum;
      }
    } catch (err) {
      if (err.code === 404) {
        // Counter doesn't exist yet — create it
      } else if (err.code === 412) {
        // Precondition failed (ETag mismatch) — retry
        continue;
      } else {
        throw err;
      }
    }

    // Create counter if it doesn't exist
    try {
      await container.items.create({ id: counterId, currentValue: 1 });
      return 1;
    } catch (err) {
      if (err.code === 409) {
        // Another request created it — retry read
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to allocate hacker number after 10 attempts");
}
