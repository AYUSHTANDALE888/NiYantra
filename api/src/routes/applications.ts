import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { h, parse } from '../lib/http.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { addDays } from '../lib/dates.js';
import { now } from '../lib/clock.js';
import { upload } from '../lib/storage.js';
import { currentUser } from '../auth/middleware.js';
import { scopeWhere, inScope } from '../policy/scope.js';
import { logAccessDenied } from '../policy/roles.js';
import { actionBodySchema, performAction, submitApplication, submitSchema, type UploadInput } from '../workflow/actions.js';
import { caseDetail, listRows } from '../workflow/present.js';

const listQuery = z.object({
  stage: z.enum(['SCRUTINY', 'EVC', 'SAC_SHC', 'DECISION']).optional(),
  status: z.enum(['IN_STAGE', 'RETURNED', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'CLOSED']).optional(),
  type: z.enum(['NEW_INSTITUTION', 'EXTENSION', 'NAME_CHANGE', 'INTAKE_INCREASE', 'CHANGE_OF_SITE', 'VERIFICATION_VISIT', 'RESTORATION']).optional(),
  mine: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
});

const fileMetaSchema = z.array(z.object({ kind: z.string().min(1).max(60), expiryDate: z.string().nullable().optional() })).max(20);

/** Pair uploaded files with their {kind, expiryDate} metadata sent as a JSON field. */
export function uploadsFrom(req: Request): UploadInput[] {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return [];
  let meta: z.infer<typeof fileMetaSchema>;
  try {
    meta = parse(fileMetaSchema, JSON.parse(String(req.body.fileMeta ?? '[]')));
  } catch (e) {
    if (e instanceof SyntaxError) throw badRequest('fileMeta must be JSON.');
    throw e;
  }
  if (meta.length !== files.length) throw badRequest('Each file needs a document kind.');
  return files.map((f, i) => ({ buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype, kind: meta[i]!.kind, expiryDate: meta[i]!.expiryDate ?? null }));
}

function jsonField(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    throw badRequest('A form field that should be JSON is not valid JSON.');
  }
}

export function applicationsRouter(): Router {
  const r = Router();

  r.get(
    '/',
    h(async (req, res) => {
      const user = currentUser(req);
      const q = parse(listQuery, req.query);
      const and: Prisma.ApplicationWhereInput[] = [await scopeWhere(user)];
      if (q.stage) and.push({ stage: q.stage });
      if (q.status) and.push({ status: q.status });
      if (q.type) and.push({ type: q.type });
      if (q.q) and.push({ OR: [{ applicationNo: { contains: q.q, mode: 'insensitive' } }, { institution: { name: { contains: q.q, mode: 'insensitive' } } }] });
      if (q.mine === 'true') {
        if (user.role === 'COMMITTEE') {
          and.push({ OR: [{ evcVisit: { memberIds: { array_contains: [user.id] } }, stage: 'EVC', evcScheduled: true }, { stage: 'SAC_SHC', sacForwarded: true }] });
        } else if (user.role === 'AUTHORITY') {
          and.push({ stage: 'DECISION', status: 'IN_STAGE' });
        } else if (user.role !== 'COLLEGE') {
          and.push({ assignments: { some: { officerId: user.id, releasedAt: null } } });
        }
      }
      const apps = await prisma.application.findMany({
        where: { AND: and },
        include: { institution: { select: { name: true, permanentId: true } }, region: { select: { code: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 500,
      });
      res.json({ rows: await listRows(user, apps) });
    }),
  );

  r.get(
    '/:id',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      if (!(await inScope(user, id))) {
        await logAccessDenied(user, { applicationId: id, path: req.originalUrl, reason: 'Application outside the user’s scope' });
        throw notFound();
      }
      res.json(await caseDetail(user, id));
    }),
  );

  r.post(
    '/',
    upload.array('files', 20),
    h(async (req, res) => {
      const user = currentUser(req);
      const body = parse(submitSchema, {
        type: req.body.type,
        formData: jsonField(req.body.formData),
        draftId: req.body.draftId,
        justification: req.body.justification || undefined,
      });
      const id = await submitApplication(user, body, uploadsFrom(req));
      res.status(201).json(await caseDetail(user, id));
    }),
  );

  r.post(
    '/:id/actions',
    upload.array('files', 20),
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      const raw = { action: req.body.action, reason: req.body.reason || undefined, payload: jsonField(req.body.payload) };
      const body = parse(actionBodySchema, raw);
      await performAction(user, id, body.action, { reason: body.reason, payload: body.payload }, uploadsFrom(req));
      if (await inScope(user, id)) res.json(await caseDetail(user, id));
      else res.json({ ok: true, id });
    }),
  );

  r.get(
    '/:id/committee',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      if (!(await inScope(user, id))) throw notFound();

      const memberships = await prisma.committeeMembership.findMany({
        where: { applicationId: id },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });
      const recommendations = await prisma.recommendation.findMany({
        where: { applicationId: id },
        orderBy: { at: 'asc' },
      });
      const QUORUM = 2;
      res.json({
        quorum: QUORUM,
        recommendationsCount: recommendations.length,
        quorumReached: recommendations.length >= QUORUM,
        members: memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.committeeRole,
          recused: m.recused,
          recusedReason: m.recusedReason,
          hasRecommended: recommendations.some((r) => r.memberId === m.userId),
        })),
        recommendations: recommendations.map((r) => ({
          id: r.id,
          memberId: r.memberId,
          text: r.text,
          at: r.at,
        })),
      });
    }),
  );

  r.post(
    '/:id/committee/recuse',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      const { reason } = parse(z.object({ reason: z.string().trim().min(1).max(1000) }), req.body);

      const membership = await prisma.committeeMembership.findFirst({
        where: { applicationId: id, userId: user.id, committeeRole: 'SAC_SHC' },
      });
      if (!membership) throw badRequest('You are not appointed to this committee.');

      await prisma.committeeMembership.update({
        where: { id: membership.id },
        data: { recused: true, recusedReason: reason },
      });

      const { appendAudit } = await import('../lib/audit.js');
      await prisma.$transaction(async (tx) => {
        await appendAudit(tx, {
          actorId: user.id,
          actorRole: user.role,
          action: 'COMMITTEE_RECUSED',
          applicationId: id,
          reason,
          meta: { committeeRole: membership.committeeRole, userId: user.id },
        });
      });

      res.json({ ok: true, recused: true, reason });
    }),
  );

  const appealSchema = z.object({
    reason: z.string().trim().min(10, 'Enter at least 10 characters explaining your grounds for appeal.').max(4000),
    documentId: z.string().uuid().optional(),
  });

  const appealDecisionSchema = z.object({
    outcome: z.enum(['ACCEPTED', 'REJECTED']),
    decisionReason: z.string().trim().min(5, 'Enter the decision reason').max(4000),
  });

  r.post(
    '/:id/appeal',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      const body = parse(appealSchema, req.body);

      const app = await prisma.application.findUnique({ where: { id } });
      if (!app) throw notFound();

      // Only applicant institution can appeal
      if (user.role !== 'COLLEGE' || user.institutionId !== app.institutionId) {
        await logAccessDenied(user, { applicationId: id, path: req.originalUrl, action: 'APPEAL', reason: 'Only the applicant institution can appeal' });
        throw forbidden('Only the applicant institution can file an appeal.');
      }

      // Must be rejected
      if (app.status !== 'REJECTED') {
        throw badRequest('An appeal can only be filed against a rejected application.');
      }

      // One-appeal constraint
      const existing = await prisma.appeal.findFirst({ where: { applicationId: id } });
      if (existing) {
        throw badRequest('An appeal has already been filed for this application.');
      }

      // Statutory 7-day window
      const decision = await prisma.decision.findUnique({ where: { applicationId: id } });
      const decisionDate = decision?.at ?? app.lastActionAt;
      const deadline = addDays(decisionDate, 7);
      if (now().getTime() > deadline.getTime()) {
        throw badRequest('The 7-day statutory appeal window for this decision has expired.');
      }

      const appeal = await prisma.appeal.create({
        data: {
          applicationId: id,
          institutionId: app.institutionId,
          reason: body.reason,
          documentId: body.documentId ?? null,
          status: 'PENDING',
          deadline,
          filedAt: now(),
        },
      });

      const { appendAudit } = await import('../lib/audit.js');
      await prisma.$transaction(async (tx) => {
        await appendAudit(tx, {
          actorId: user.id,
          actorRole: user.role,
          action: 'APPEAL_FILED',
          applicationId: id,
          reason: body.reason,
          meta: { appealId: appeal.id, deadline: deadline.toISOString() },
        });
      });

      res.status(201).json({ ok: true, appeal });
    }),
  );

  r.get(
    '/:id/appeals',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      if (!(await inScope(user, id))) throw notFound();

      const appeals = await prisma.appeal.findMany({
        where: { applicationId: id },
        orderBy: { filedAt: 'desc' },
      });
      res.json({ appeals });
    }),
  );

  r.post(
    '/:id/appeals/:appealId/decide',
    h(async (req, res) => {
      const user = currentUser(req);
      const id = parse(z.string().uuid(), req.params.id);
      const appealId = parse(z.string().uuid(), req.params.appealId);
      const body = parse(appealDecisionSchema, req.body);

      if (!['AUTHORITY', 'COMMITTEE', 'BUREAU', 'ADMIN'].includes(user.role)) {
        await logAccessDenied(user, { applicationId: id, path: req.originalUrl, action: 'APPEAL_DECIDE', reason: 'Role not authorized to decide appeals' });
        throw forbidden('You are not authorized to decide appeals.');
      }
      if (!(await inScope(user, id))) throw notFound();

      const appeal = await prisma.appeal.findUnique({ where: { id: appealId } });
      if (!appeal || appeal.applicationId !== id) throw notFound();
      if (appeal.status !== 'PENDING' && appeal.status !== 'UNDER_REVIEW') {
        throw badRequest('This appeal has already been decided.');
      }

      const updated = await prisma.appeal.update({
        where: { id: appealId },
        data: {
          status: body.outcome,
          decisionReason: body.decisionReason,
          decidedById: user.id,
          decidedAt: now(),
        },
      });

      const { appendAudit } = await import('../lib/audit.js');
      await prisma.$transaction(async (tx) => {
        await appendAudit(tx, {
          actorId: user.id,
          actorRole: user.role,
          action: 'APPEAL_DECIDED',
          applicationId: id,
          reason: body.decisionReason,
          meta: { appealId, outcome: body.outcome },
        });

        if (body.outcome === 'ACCEPTED') {
          // If appeal allowed by SAC, restore case to DECISION for reconsideration
          await tx.application.update({
            where: { id },
            data: { status: 'IN_STAGE', stage: 'DECISION', lastActionAt: now() },
          });
        }
      });

      res.json({ ok: true, appeal: updated });
    }),
  );

  return r;
}
