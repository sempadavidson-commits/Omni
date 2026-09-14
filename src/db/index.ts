import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: pg.Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      maxUses: 1000,
      ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.warn('[DB Pool] Idle client error caught by pool:', err?.message || err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 300): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (i < retries) {
        const fullErrStr = `${err?.name || ''} ${err?.message || ''} ${err?.code || ''} ${err?.cause?.name || ''} ${err?.cause?.message || ''} ${err?.cause?.code || ''} ${String(err?.cause || '')} ${String(err || '')}`.toLowerCase();
        const code = (err?.code || err?.cause?.code || "");

        const isConnErr =
          code === 'ECONNRESET' ||
          code === 'EPIPE' ||
          code === 'ECONNREFUSED' ||
          code === 'ETIMEDOUT' ||
          code === '57P01' ||
          code === '08006' ||
          code === '08001' ||
          code === '08004' ||
          fullErrStr.includes('econnreset') ||
          fullErrStr.includes('epipe') ||
          fullErrStr.includes('econnrefused') ||
          fullErrStr.includes('etimedout') ||
          fullErrStr.includes('connection') ||
          fullErrStr.includes('closed') ||
          fullErrStr.includes('terminated') ||
          fullErrStr.includes('broken pipe') ||
          fullErrStr.includes('unexpected end') ||
          fullErrStr.includes('timeout') ||
          fullErrStr.includes('drizzlequeryerror');

        if (isConnErr) {
          const backoff = (delayMs * Math.pow(1.5, i)) + Math.floor(Math.random() * 200);
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }
      }
      break;
    }
  }
  throw lastError;
}
