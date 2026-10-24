import { Prisma, PrismaClient } from '@prisma/client';

function makeClient(): PrismaClient {
  return new PrismaClient({ log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'] });
}

// Live binding: reconnect() swaps the client after a demo reset recreates the database.
export let prisma: PrismaClient = makeClient();

export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;

export async function reconnect(): Promise<void> {
  const old = prisma;
  prisma = makeClient();
  await old.$disconnect().catch(() => undefined);
}

export const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;
