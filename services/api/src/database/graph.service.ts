import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL, GRAPH_NAME } from './database.constants';

export interface CypherResultRow {
  [key: string]: unknown;
}

@Injectable()
export class GraphService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async runCypher<T extends CypherResultRow>(
    cypher: string,
    params: Record<string, unknown> = {},
    columns: string[],
  ): Promise<T[]> {
    return this.withAgeSession(async (client) => {
      const columnDefs = columns.map((c) => `${c} agtype`).join(', ');
      const sql = this.buildCypherSql(cypher, columnDefs);
      const bindValues = this.bindValues(params);
      const { rows } = await client.query(sql, bindValues);
      return rows.map((row) => this.parseRow(row)) as T[];
    });
  }

  async runCypherWrite(
    cypher: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    await this.withAgeSession(async (client) => {
      const sql = this.buildCypherSql(cypher, 'result agtype');
      const bindValues = this.bindValues(params);
      await client.query(sql, bindValues);
    });
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  private async withAgeSession<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.withClient(async (client) => {
      await client.query(`LOAD 'age'`);
      await client.query(`SET search_path = ag_catalog, "$user", public`);
      return fn(client);
    });
  }

  /**
   * AGE requires the Cypher string to be a SQL literal (not a bind parameter).
   * Parameters are passed as the optional third argument as agtype JSON map.
   */
  private buildCypherSql(cypher: string, columnDefs: string): string {
    const hasParams = true; // always pass third arg for consistent signature
    const thirdArg = hasParams ? ', $1::agtype' : '';
    return `SELECT * FROM cypher('${GRAPH_NAME}', $cypher$${cypher}$cypher$${thirdArg}) AS (${columnDefs})`;
  }

  private bindValues(params: Record<string, unknown>): string[] {
    return [JSON.stringify(params)];
  }

  private parseRow(row: Record<string, unknown>): CypherResultRow {
    const parsed: CypherResultRow = {};
    for (const [key, value] of Object.entries(row)) {
      parsed[key] = this.parseAgtype(value);
    }
    return parsed;
  }

  private parseAgtype(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      // AGE appends type casts like ::vertex that break JSON.parse
      const cleaned = value.replace(/::(vertex|edge|path)/gi, '');
      try {
        return JSON.parse(cleaned);
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.parseAgtype(item));
    }
    return value;
  }
}
