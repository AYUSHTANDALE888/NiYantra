import request from 'supertest';
import type { Express } from 'express';
import type { AppType } from '@prisma/client';
import { prisma } from '../src/lib/db.js';
import { placeholderPdf } from '../src/lib/storage.js';
import { addDays, isoDate } from '../src/lib/dates.js';
import * as clock from '../src/lib/clock.js';
import { rules } from '../src/config/index.js';
import { bearer } from './helpers.js';

export const PDF = placeholderPdf(['Test document']);

export function defaultForm(type: AppType, overrides: Record<string, unknown> = {}) {
  return {
    landAreaSqm: 20000,
    builtupAreaSqm: 9000,
    courses: [
      { name: 'B.Tech Computer Science', intake: 120, years: 4 },
      { name: 'B.Tech Electronics', intake: 60, years: 4 },
    ],
    facultyCount: 60,
    labCount: 12,
    leaseExpiry: isoDate(addDays(clock.today(), 365 * 3)),
    fillSeconds: 900,
    ...(type === 'INTAKE_INCREASE' ? { intakeIncreasePct: 20 } : {}),
    ...(type === 'NAME_CHANGE' ? { proposedName: 'New Name College of Engineering' } : {}),
    ...overrides,
  };
}

export function criticalKinds(type: AppType): string[] {
  return rules.types[type].documents.filter((d) => d.critical).map((d) => d.kind);
}

let draftNo = 0;

export async function submitApp(
  app: Express,
  user: { id: string; role: string },
  opts: { type?: AppType; form?: Record<string, unknown>; docs?: string[]; justification?: string; draftId?: string } = {},
) {
  const type = opts.type ?? 'NEW_INSTITUTION';
  const docs = opts.docs ?? criticalKinds(type);
  const expiry = isoDate(addDays(clock.today(), 365 * 2));
  const meta = docs.map((kind) => ({ kind, expiryDate: rules.types[type].documents.find((d) => d.kind === kind)?.hasExpiry ? expiry : null }));
  let req = request(app)
    .post('/api/applications')
    .set(...bearer(user))
    .field('type', type)
    .field('formData', JSON.stringify(opts.form ?? defaultForm(type)))
    .field('draftId', opts.draftId ?? `draft-${Date.now()}-${draftNo++}`)
    .field('fileMeta', JSON.stringify(meta));
  if (opts.justification) req = req.field('justification', opts.justification);
  for (const k of docs) req = req.attach('files', PDF, { filename: `${k.toLowerCase()}.pdf`, contentType: 'application/pdf' });
  return req;
}

export async function act(app: Express, user: { id: string; role: string }, id: string, action: string, body: { reason?: string; payload?: unknown } = {}) {
  return request(app)
    .post(`/api/applications/${id}/actions`)
    .set(...bearer(user))
    .send({ action, ...body });
}

/** Test fixture only: mark an institution as previously approved so EXTENSION-type applications are eligible. */
export async function grantPriorApproval(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
  const at = addDays(clock.today(), -400);
  await prisma.application.create({
    data: {
      applicationNo: `FIXTURE-${institutionId.slice(0, 8)}`,
      institutionId,
      regionId: inst.regionId,
      type: 'NEW_INSTITUTION',
      category: 'NEW',
      categoryRank: 0,
      route: ['SCRUTINY', 'EVC', 'DECISION'],
      stage: 'DECISION',
      status: 'APPROVED',
      holderType: 'NONE',
      submittedAt: at,
      stageEnteredAt: at,
      lastActionAt: at,
      formData: {},
    },
  });
}

export async function collegeOf(institutionName: string) {
  return prisma.user.findFirstOrThrow({
    where: { role: 'COLLEGE', institution: { name: institutionName } },
    select: { id: true, name: true, email: true, role: true, regionId: true, institutionId: true, reportsToId: true, title: true },
  });
}

export async function openAssignment(applicationId: string) {
  return prisma.assignment.findFirst({ where: { applicationId, releasedAt: null }, include: { officer: true } });
}

export async function userById(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, email: true, role: true, regionId: true, institutionId: true, reportsToId: true, title: true },
  });
}
