import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 250): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const combinedMsg = [
        err?.message,
        err?.cause?.message,
        err?.cause?.code,
        err?.code,
      ].filter(Boolean).join(' ').toLowerCase();

      const isConnectionError =
        combinedMsg.includes('connection terminated') ||
        combinedMsg.includes('closed') ||
        combinedMsg.includes('econnreset') ||
        combinedMsg.includes('timeout') ||
        combinedMsg.includes('broken pipe') ||
        combinedMsg.includes('socket') ||
        combinedMsg.includes('client has encountered a connection error') ||
        combinedMsg.includes('57p01') ||
        combinedMsg.includes('08006') ||
        combinedMsg.includes('08003') ||
        combinedMsg.includes('08001');

      if (isConnectionError && i < retries) {
        console.warn(`[DB Retry] Retrying query after connection glitch (${i + 1}/${retries})...`);
        await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
