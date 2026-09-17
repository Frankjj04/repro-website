/* Postgres connection and one-time schema setup.

   Works with any Postgres: Neon, Supabase, or a plain server. Vercel's Neon
   integration sets DATABASE_URL by itself; POSTGRES_URL is accepted too, since
   some integrations set that name instead. */

import pg from 'pg';
import { SCHEMA } from './schema.js';

const CONNECTION = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let pool = null;
let schemaReady = null;

export function isConfigured() {
  return Boolean(CONNECTION);
}

function getPool() {
  if (!CONNECTION) throw new Error('No DATABASE_URL is set on this project.');
  if (!pool) {
    pool = new pg.Pool({
      connectionString: CONNECTION,
      // Verify the server's certificate chain. Checked against Neon: it
      // presents a chain Node trusts, so there is no reason to skip this.
      ssl: true,
      max: 3,                       // serverless: many instances, few each
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on('error', () => { /* a dropped idle client must not kill the process */ });
  }
  return pool;
}

/* Applies the schema once per warm instance. Every statement is
   IF NOT EXISTS, so running it repeatedly is free and harmless. */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(SCHEMA).catch((err) => {
      schemaReady = null;            // let the next request try again
      throw err;
    });
  }
  return schemaReady;
}

export async function query(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}
