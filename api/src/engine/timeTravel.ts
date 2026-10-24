import type { AuthUser } from '../auth/middleware.js';
import * as clock from '../lib/clock.js';
import { isoDate } from '../lib/dates.js';
import { appendAuditStandalone } from '../lib/audit.js';

export interface AdvanceResult {
  today: string;
  offsetDays: number;
  cycle: Record<string, number> | null;
}

/** Phase 0: move the simulated clock. Phase 2 adds the synchronous engine cycle. */
export async function advanceTime(actor: AuthUser, days: number): Promise<AdvanceResult> {
  const offsetDays = await clock.advance(days);
  await appendAuditStandalone({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'TIME_ADVANCED',
    meta: { days, offsetDays, today: isoDate(clock.today()) },
  });
  return { today: isoDate(clock.today()), offsetDays, cycle: null };
}
