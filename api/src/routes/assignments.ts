import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { h, parse } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import { currentUser } from '../auth/middleware.js';
import { requireRole } from '../policy/roles.js';
import { listUnassigned } from '../assignment/unassigned.js';
import { assignManual } from '../assignment/engine.js';

export function assignmentsRouter(): Router {
  const r = Router();

  // The caller's own load, for the utilisation bar ("6.2 of 10 points").
  r.get(
    '/my-load',
    requireRole('OFFICER', 'BUREAU'),
    h(async (req, res) => {
      const user = currentUser(req);
      const [profile, open] = await Promise.all([
        prisma.officerProfile.findUnique({ where: { userId: user.id } }),
        prisma.assignment.aggregate({ where: { officerId: user.id, releasedAt: null }, _sum: { weight: true }, _count: true }),
      ]);
      res.json({ openPoints: Math.round(Number(open._sum.weight ?? 0) * 100) / 100, openTasks: open._count, capacity: Number(profile?.capacityPoints ?? 0) });
    }),
  );

  r.get(
    '/unassigned',
    requireRole('HOD', 'BUREAU'),
    h(async (req, res) => {
      const user = currentUser(req);
      const where: Prisma.ApplicationWhereInput = user.role === 'HOD' ? { regionId: user.regionId ?? '-' } : {};
      res.json({ rows: await listUnassigned(where) });
    }),
  );

  r.post(
    '/unassigned/assign',
    requireRole('HOD', 'BUREAU'),
    h(async (req, res) => {
      const user = currentUser(req);
      const body = parse(
        z.object({
          applicationId: z.string().uuid(),
          taskType: z.enum(['SCRUTINY', 'RE_SCRUTINY', 'EVC_DESK', 'VERIFY', 'SAC_SHC_FORWARD']),
          taskRefId: z.string().max(80).default(''),
          toOfficerId: z.string().uuid(),
          reason: z.string().trim().min(1, 'Enter a reason').max(1000),
        }),
        req.body,
      );
      res.json(await assignManual(user, body));
    }),
  );

  return r;
}
