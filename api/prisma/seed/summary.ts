import { prisma } from '../../src/lib/db.js';
import { NAMED_DEMO_EMAILS, DEMO_PASSWORD } from '../../src/auth/demoUsers.js';
import type { Directory } from './directory.js';

export async function printSummary(_dir: Directory): Promise<void> {
  const byStage = await prisma.application.groupBy({ by: ['stage', 'status'], _count: true });
  if (byStage.length) {
    console.log('\nApplications by stage and status');
    console.table(byStage.map((r) => ({ stage: r.stage, status: r.status, count: r._count })));
  }
  const flags = await prisma.exceptionFlag.groupBy({ by: ['reasonCode'], where: { resolvedAt: null }, _count: true });
  if (flags.length) {
    console.log('\nOpen flags by reason code');
    console.table(flags.map((r) => ({ reasonCode: r.reasonCode, count: r._count })));
  }
  const users = await prisma.user.findMany({
    where: { email: { in: [...NAMED_DEMO_EMAILS] } },
    select: { email: true, name: true, role: true, region: { select: { code: true } } },
  });
  console.log(`\nDemo users (password for all: ${DEMO_PASSWORD})`);
  console.table(users.map((u) => ({ email: u.email, name: u.name, role: u.role, region: u.region?.code ?? '' })));
}
