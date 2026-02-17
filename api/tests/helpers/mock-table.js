import { vi } from "vitest";

export function createMockTableClient(entities = []) {
  const store = new Map();

  for (const entity of entities) {
    const key = `${entity.partitionKey}__${entity.rowKey}`;
    store.set(key, { ...entity });
  }

  return {
    createTable: vi.fn().mockResolvedValue(undefined),

    createEntity: vi.fn().mockImplementation(async (entity) => {
      const key = `${entity.partitionKey}__${entity.rowKey}`;
      if (store.has(key)) {
        const err = new Error("Conflict");
        err.statusCode = 409;
        throw err;
      }
      store.set(key, { ...entity });
      return entity;
    }),

    getEntity: vi.fn().mockImplementation(async (pk, rk) => {
      const key = `${pk}__${rk}`;
      if (!store.has(key)) {
        const err = new Error("Not Found");
        err.statusCode = 404;
        throw err;
      }
      return store.get(key);
    }),

    updateEntity: vi.fn().mockImplementation(async (entity, mode) => {
      const key = `${entity.partitionKey}__${entity.rowKey}`;
      if (!store.has(key)) {
        const err = new Error("Not Found");
        err.statusCode = 404;
        throw err;
      }
      const existing = store.get(key);
      store.set(key, { ...existing, ...entity });
      return store.get(key);
    }),

    upsertEntity: vi.fn().mockImplementation(async (entity) => {
      const key = `${entity.partitionKey}__${entity.rowKey}`;
      const existing = store.get(key) || {};
      store.set(key, { ...existing, ...entity });
      return store.get(key);
    }),

    deleteEntity: vi.fn().mockImplementation(async (pk, rk) => {
      const key = `${pk}__${rk}`;
      if (!store.has(key)) {
        const err = new Error("Not Found");
        err.statusCode = 404;
        throw err;
      }
      store.delete(key);
    }),

    listEntities: vi.fn().mockImplementation((options) => {
      const filter = options?.queryOptions?.filter;
      let values = [...store.values()];

      if (filter) {
        // Simple filter parsing for PartitionKey eq 'value'
        const pkMatch = filter.match(/PartitionKey eq '([^']+)'/);
        if (pkMatch) {
          values = values.filter((e) => e.partitionKey === pkMatch[1]);
        }
        const statusMatch = filter.match(/status eq '([^']+)'/);
        if (statusMatch) {
          values = values.filter((e) => e.status === statusMatch[1]);
        }
      }

      return {
        [Symbol.asyncIterator]: async function* () {
          for (const v of values) {
            yield v;
          }
        },
      };
    }),

    _store: store,
  };
}

export function createMockRequest({
  method = "GET",
  body,
  query = {},
  headers = new Map(),
} = {}) {
  const queryMap = new Map(Object.entries(query));
  return {
    method,
    headers:
      headers instanceof Map ? headers : new Map(Object.entries(headers)),
    query: queryMap,
    json: vi.fn().mockResolvedValue(body),
  };
}

export function createAuthHeaders(
  roles = ["authenticated"],
  username = "testuser",
) {
  const principal = {
    userId: "test-id",
    userDetails: username,
    userRoles: roles,
    identityProvider: "github",
  };
  const encoded = Buffer.from(JSON.stringify(principal)).toString("base64");
  return new Map([["x-ms-client-principal", encoded]]);
}
