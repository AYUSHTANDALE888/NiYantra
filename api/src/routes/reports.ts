import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { h, parse } from '../lib/http.js';
import { forbidden, notFound } from '../lib/errors.js';
import { currentUser, type AuthUser } from '../auth/middleware.js';
import { requireRole } from '../policy/roles.js';
import { getSubtreeUserIds } from '../policy/subtree.js';
import { teamReport } from '../reports/team.js';
import { appendAudit } from '../lib/audit.js';
import { isoDate, toDateOnly, calendarDaysBetween } from '../lib/dates.js';
import { workingDaysBetween } from '../lib/workdays.js';
import { today } from '../lib/clock.js';

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

const NOTHING: Prisma.ApplicationWhereInput = { id: '00000000-0000-0000-0000-000000000000' };

export async function reportScopeWhere(user: AuthUser): Promise<Prisma.ApplicationWhereInput> {
  switch (user.role) {
    case 'COLLEGE':
      return user.institutionId ? { institutionId: user.institutionId } : NOTHING;
    case 'OFFICER':
    case 'SENIOR':
    case 'SUPER_SENIOR':
    case 'HOD':
    case 'AUTHORITY':
      return user.regionId ? { regionId: user.regionId } : NOTHING;
    case 'BUREAU':
    case 'ADMIN':
      return {};
    default:
      return NOTHING;
  }
}

async function auditExport(user: AuthUser, report: string) {
  await prisma.$transaction(async (tx) => {
    await appendAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      action: 'REPORT_EXPORTED',
      reason: `Exported ${report} report`,
      meta: { report },
    });
  });
}

export function reportsRouter(): Router {
  const r = Router();

  r.get(
    '/team',
    requireRole('SENIOR', 'SUPER_SENIOR', 'HOD'),
    h(async (req, res) => {
      const user = currentUser(req);
      const q = parse(z.object({ period: z.enum(['7', '30', '90']).default('30'), drill: z.string().uuid().optional() }), req.query);
      let base = { id: user.id, name: user.name, role: user.role as string };
      if (q.drill && q.drill !== user.id) {
        if (!(await getSubtreeUserIds(user.id)).includes(q.drill)) throw forbidden('You can drill down only into your own team.');
        const u = await prisma.user.findUnique({ where: { id: q.drill }, select: { id: true, name: true, role: true } });
        if (!u) throw notFound();
        base = u;
      }
      res.json(await teamReport(user, base, Number(q.period)));
    }),
  );

  r.get(
    '/pendency.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const apps = await prisma.application.findMany({
        where: { ...where, status: 'IN_STAGE' },
        include: {
          institution: true,
          region: true,
          assignments: { where: { releasedAt: null }, include: { officer: true } },
          deadlineItems: { where: { status: 'OPEN' } },
        },
        orderBy: [{ stage: 'asc' }, { stageEnteredAt: 'asc' }],
      });
      const t = today();
      const rows = apps.map((a) => [
        a.applicationNo,
        a.institution.name,
        a.region.code,
        a.type,
        a.stage,
        workingDaysBetween(toDateOnly(a.stageEnteredAt), t),
        a.assignments[0]?.officer?.name ?? 'Unassigned',
        a.deadlineItems.length,
      ]);
      await auditExport(user, 'pendency');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pendency-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'Type', 'Stage', 'Days in Stage', 'Assigned Officer', 'Open Items Count'], rows));
    }),
  );

  r.get(
    '/evc.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const apps = await prisma.application.findMany({
        where: { ...where, evcVisit: { isNot: null } },
        include: {
          institution: true,
          region: true,
          evcVisit: true,
          evcVisitEvents: { orderBy: { at: 'desc' }, take: 1 },
        },
        orderBy: { applicationNo: 'asc' },
      });
      const t = today();
      const rows = apps.map((a) => [
        a.applicationNo,
        a.institution.name,
        a.region.code,
        a.evcVisit?.status ?? 'N/A',
        a.evcVisit?.visitDate ? isoDate(a.evcVisit.visitDate) : '',
        a.evcVisit?.mode ?? '',
        ((a.evcVisit?.memberIds as string[]) ?? []).length,
        a.evcVisit?.recommendation ?? '',
        a.evcVisitEvents[0]?.action ?? '',
      ]);
      await auditExport(user, 'evc');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="evc-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'EVC Status', 'Visit Date', 'Mode', 'Members Count', 'Recommendation', 'Latest Event'], rows));
    }),
  );

  r.get(
    '/compliance.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const undertakings = await prisma.undertaking.findMany({
        where: { application: where },
        include: {
          application: { include: { institution: true, region: true } },
          rounds: { orderBy: { roundNumber: 'asc' } },
        },
        orderBy: { dueDate: 'asc' },
      });
      const t = today();
      const rows = undertakings.map((u) => {
        const lastRound = u.rounds[u.rounds.length - 1];
        return [
          u.application.applicationNo,
          u.application.institution.name,
          u.application.region.code,
          u.condition,
          isoDate(u.dueDate),
          u.status,
          u.rounds.length,
          lastRound?.verdict ?? '',
          u.remarks ?? lastRound?.remarks ?? '',
        ];
      });
      await auditExport(user, 'compliance');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'Condition', 'Due Date', 'Status', 'Rounds Count', 'Latest Verdict', 'Latest Remarks'], rows));
    }),
  );

  r.get(
    '/validity.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const apps = await prisma.application.findMany({
        where: { ...where, status: { in: ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'CLOSED'] } },
        include: {
          institution: true,
          region: true,
          decision: true,
          documents: { where: { verified: true, expiryDate: { not: null } } },
        },
        orderBy: { applicationNo: 'asc' },
      });
      const t = today();
      const rows: (string | number | null | undefined)[][] = [];
      for (const a of apps) {
        if (a.documents.length === 0) {
          rows.push([
            a.applicationNo,
            a.institution.name,
            a.region.code,
            a.decision?.outcome ?? a.status,
            a.decision ? isoDate(a.decision.at) : '',
            'None',
            '',
            '',
          ]);
        } else {
          for (const d of a.documents) {
            rows.push([
              a.applicationNo,
              a.institution.name,
              a.region.code,
              a.decision?.outcome ?? a.status,
              a.decision ? isoDate(a.decision.at) : '',
              d.kind,
              isoDate(d.expiryDate!),
              calendarDaysBetween(t, d.expiryDate!),
            ]);
          }
        }
      }
      await auditExport(user, 'validity');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="validity-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'Approval Outcome', 'Decided Date', 'Critical Doc Kind', 'Doc Expiry Date', 'Days to Expiry'], rows));
    }),
  );

  r.get(
    '/overdue.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const t = today();
      const items = await prisma.deadlineItem.findMany({
        where: { application: where, status: 'OPEN', dueDate: { lt: t } },
        include: {
          application: { include: { institution: true, region: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      const rows = items.map((item) => [
        item.application.applicationNo,
        item.application.institution.name,
        item.application.region.code,
        item.type,
        isoDate(item.dueDate),
        calendarDaysBetween(item.dueDate, t),
        item.escalationLevel,
      ]);
      await auditExport(user, 'overdue');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="overdue-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'Item Type', 'Due Date', 'Days Overdue', 'Escalation Level'], rows));
    }),
  );

  r.get(
    '/processing-time.csv',
    h(async (req, res) => {
      const user = currentUser(req);
      const where = await reportScopeWhere(user);
      const apps = await prisma.application.findMany({
        where: { ...where, status: { in: ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'CLOSED'] } },
        include: {
          institution: true,
          region: true,
          decision: true,
        },
        orderBy: { applicationNo: 'asc' },
      });
      const t = today();
      const rows = apps.map((a) => {
        const decidedAt = toDateOnly(a.decision?.at ?? a.lastActionAt);
        const submittedAt = toDateOnly(a.submittedAt);
        return [
          a.applicationNo,
          a.institution.name,
          a.region.code,
          a.type,
          a.status,
          isoDate(a.submittedAt),
          isoDate(decidedAt),
          calendarDaysBetween(submittedAt, decidedAt),
          workingDaysBetween(submittedAt, decidedAt),
        ];
      });
      await auditExport(user, 'processing-time');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="processing-time-${isoDate(t)}.csv"`);
      res.send(toCsv(['Application No', 'Institution', 'Region', 'Type', 'Final Status', 'Submitted At', 'Decided At', 'Total Calendar Days', 'Total Working Days'], rows));
    }),
  );

  return r;
}
