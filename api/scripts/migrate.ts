// prisma migrate deploy as aicte_migrator, then the audit guard SQL. Usage: tsx scripts/migrate.ts [databaseUrl]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '..');

export async function migrate(url: string): Promise<void> {
  execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  const sql = fs.readFileSync(path.join(apiDir, 'prisma/sql/001_audit_guard.sql'), 'utf8');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
  console.log('[migrate] schema and audit guard applied');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.argv[2] ?? process.env.MIGRATOR_URL;
  if (!url) throw new Error('MIGRATOR_URL is not set');
  migrate(url).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
