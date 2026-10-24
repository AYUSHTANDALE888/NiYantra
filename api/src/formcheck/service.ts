// POST /forms/validate: hard validation here, then the Python scorer with an 800 ms timeout, else Node rules.
import type { AppType, Prisma, Severity } from '@prisma/client';
import type { AuthUser } from '../auth/middleware.js';
import { prisma, type Db } from '../lib/db.js';
import { isoDate } from '../lib/dates.js';
import { now, today } from '../lib/clock.js';
import { appendAuditStandalone } from '../lib/audit.js';
import { computeFeatures, requiredDocKinds, requiredMissing, type FormValues } from './features.js';
import { evaluateRules, type Warning } from './rules.js';
import { postJson } from './client.js';
import { formcheckRules } from '../config/index.js';

export interface ValidateResponse {
  id: string;
  modelVersion: string;
  modelAvailable: boolean;
  severity: Severity;
  score: number | null;
  threshold: number | null;
  warnings: Warning[];
  requiredMissing: { field: string; message: string }[];
  canSubmit: true;
  justificationRequired: boolean;
}

interface ScoreResponse {
  modelVersion: string;
  severity: Severity;
  score: number | null;
  threshold: number | null;
  warnings: Warning[];
}

export async function scoreForm(type: AppType, values: FormValues) {
  const todayIso = isoDate(today());
  try {
    const r = await postJson<ScoreResponse>('/score', { type, values, today: todayIso, requiredDocs: requiredDocKinds(type) });
    return { ...r, modelAvailable: true };
  } catch {
    const warnings = evaluateRules(computeFeatures(type, values, todayIso));
    return {
      modelVersion: `rules-v${formcheckRules.version}`,
      modelAvailable: false,
      severity: (warnings.length ? 'HIGH' : 'NONE') as Severity,
      score: null,
      threshold: null,
      warnings,
    };
  }
}

export async function validateForm(user: AuthUser, input: { draftId: string; type: AppType; values: FormValues }, db: Db = prisma): Promise<ValidateResponse> {
  const missing = requiredMissing(input.type, input.values);
  const r = await scoreForm(input.type, input.values);
  const row = await db.formCheckResult.create({
    data: {
      institutionId: user.institutionId!,
      draftId: input.draftId,
      modelVersion: r.modelVersion,
      modelAvailable: r.modelAvailable,
      score: r.score,
      threshold: r.threshold,
      severity: r.severity,
      warnings: r.warnings as unknown as Prisma.InputJsonValue,
      createdAt: now(),
    },
  });
  if (r.severity !== 'NONE') {
    await appendAuditStandalone(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'FORM_CHECK_WARNING',
        meta: { draftId: input.draftId, formCheckId: row.id, severity: r.severity, modelAvailable: r.modelAvailable, warnings: r.warnings.length },
      },
      db,
    );
  }
  return {
    id: row.id,
    modelVersion: r.modelVersion,
    modelAvailable: r.modelAvailable,
    severity: r.severity,
    score: r.score,
    threshold: r.threshold,
    warnings: r.warnings,
    requiredMissing: missing,
    canSubmit: true,
    justificationRequired: r.severity !== 'NONE',
  };
}
