// /api/rules: rule packs (add-on A7). This step adds the filing context for the apply form; the Rules Center
// endpoints (cycles, versions, diff, impact, import/export, public notices) follow in the same router.
import { Router } from 'express';
import { z } from 'zod';
import { h, parse } from '../lib/http.js';
import { currentUser } from '../auth/middleware.js';
import { requireRole } from '../policy/roles.js';
import { filingContext } from '../rules/filing.js';
import { APP_TYPES } from '../rules/schema.js';
import type { ResolvedRules } from '../rules/resolved.js';

const STAGE_NAME: Record<string, string> = { SCRUTINY: 'Scrutiny', EVC: 'EVC', SAC_SHC: 'SAC/SHC', DECISION: 'Decision' };

/** Plain words for a route step's condition. */
function stepLabel(r: ResolvedRules, stage: string, when: unknown, programme: ReturnType<ResolvedRules['programme']>): string {
  if (when === undefined) return STAGE_NAME[stage] ?? stage;
  const pct = JSON.stringify(when).includes('norms.evcIntakeIncreasePct') ? r.norm('evcIntakeIncreasePct', programme) : null;
  return pct !== null ? `${STAGE_NAME[stage]} if intake rises over ${pct}%` : `${STAGE_NAME[stage]} (when its condition applies)`;
}

export function rulesRouter(): Router {
  const r = Router();

  // The cycle and rules a filing today falls under, with what the apply form needs from them.
  r.get(
    '/filing',
    requireRole('COLLEGE'),
    h(async (req, res) => {
      const user = currentUser(req);
      const q = parse(z.object({ programme: z.string().regex(/^[A-Z0-9_]{2,20}$/).optional() }), req.query);
      const fc = await filingContext(user.institutionId!, null, q.programme ? { programme: q.programme } : {});
      const rules = fc.rules;
      const programme = rules.programme(q.programme ?? null);
      const ctx = { ...fc.facts, programme };
      res.json({
        open: fc.filing.ok,
        message: fc.filing.ok ? null : fc.filing.message,
        window: fc.filing.ok ? fc.filing.window : null,
        lateFeeInr: fc.filing.ok ? fc.filing.lateFeeInr : null,
        rules: { versionId: rules.pinned.id, cycle: rules.pinned.cycleCode, version: rules.pinned.version, label: rules.label, effectiveFrom: rules.pinned.effectiveFrom },
        programmes: rules.content.programmes.map((p) => ({ code: p.code, label: p.label, level: p.level, discipline: p.discipline, inPurview: rules.test(p.inPurview, { ...ctx, programme: p }) })),
        types: rules.content.applicationTypes
          .filter((t) => (APP_TYPES as readonly string[]).includes(t.type))
          .map((t) => ({
            type: t.type,
            label: t.label,
            category: t.category,
            channel: t.channel,
            eligible: rules.test(t.eligibility, { ...ctx, application: { type: t.type } }),
            route: t.route.map((s) => stepLabel(rules, s.stage, s.when, programme)),
            documents: rules.documents(t.type, ctx).map((d) => ({ kind: d.kind, label: d.label, critical: d.critical, hasExpiry: d.hasExpiry, source: d.source ?? null })),
          })),
      });
    }),
  );

  return r;
}
