import pg from 'pg';
import { prisma, reconnect } from './db.js';
import * as clock from './clock.js';
import { loadHolidays } from './workdays.js';
import { clearRulesCache } from '../rules/service.js';

function adminUrl(): string {
  const url = process.env.DEMO_ADMIN_URL;
  if (!url) throw new Error('DEMO_ADMIN_URL is not set');
  return url;
}

const APP_DB = () => process.env.APP_DB_NAME ?? 'aicte';
const SEED_DB = () => process.env.TEMPLATE_DB_NAME ?? 'aicte_seed';

export async function withAdminClient<T>(fn: (c: pg.Client) => Promise<T>, database?: string): Promise<T> {
  const url = new URL(adminUrl());
  if (database) url.pathname = `/${database}`;
  const c = new pg.Client({ connectionString: url.toString() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Recreate the working database from the template. Returns elapsed milliseconds. */
export async function recreateFromTemplate(): Promise<number> {
  const started = process.hrtime.bigint();
  await withAdminClient(async (c) => {
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [SEED_DB()]);
    await c.query(`DROP DATABASE IF EXISTS "${APP_DB()}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${APP_DB()}" TEMPLATE "${SEED_DB()}" OWNER aicte_migrator`);
    await c.query(`GRANT CONNECT ON DATABASE "${APP_DB()}" TO aicte_app`);
  });
  return Number((process.hrtime.bigint() - started) / 1_000_000n);
}

/** Copy the working database into the template (end of seed). */
export async function buildTemplate(): Promise<void> {
  await withAdminClient(async (c) => {
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1, $2) AND pid <> pg_backend_pid()`, [APP_DB(), SEED_DB()]);
    await c.query(`DROP DATABASE IF EXISTS "${SEED_DB()}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${SEED_DB()}" TEMPLATE "${APP_DB()}" OWNER aicte_migrator`);
  });
}

/** Used by the API: drop its own connections, recreate, reconnect, reload cached state. */
export async function resetDemoInProcess(): Promise<number> {
  await prisma.$disconnect().catch(() => undefined);
  const ms = await recreateFromTemplate();
  await reconnect();
  await clock.refresh();
  clearRulesCache();
  await loadHolidays(prisma);
  return ms;
}
