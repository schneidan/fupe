import { Pool, type PoolClient } from 'pg';
import { resolveDatabaseUrl } from '../config';

const GRAPH_NAME = 'fupe_graph';

export function createPool(databaseUrl?: string): Pool {
  return new Pool({ connectionString: resolveDatabaseUrl(databaseUrl) });
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withAgeSession<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(pool, async (client) => {
    await client.query(`LOAD 'age'`);
    await client.query(`SET search_path = ag_catalog, "$user", public`);
    return fn(client);
  });
}

/**
 * AGE requires the Cypher string as a SQL literal; params go in `$1::agtype`.
 * Mirrors services/api GraphService.
 */
export async function runCypherWrite(
  client: PoolClient,
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  const sql = `SELECT * FROM cypher('${GRAPH_NAME}', $cypher$${cypher}$cypher$, $1::agtype) AS (result agtype)`;
  await client.query(sql, [JSON.stringify(params)]);
}
