import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { resetDb, userByEmail, bearer } from './helpers.js';
import { act, submitApp, userById, openAssignment } from './fixtures.js';
import { addDays, isoDate } from '../src/lib/dates.js';
import * as clock from '../src/lib/clock.js';
import { nextWorkingDayFrom } from '../src/lib/workdays.js';

describe('Phase D: SHC/SAC Separation and Statutory Appeals', () => {
  let app: Express;

  beforeEach(async () => {
    await resetDb();
    app = createApp();
  });

  async function committee() {
    return prisma.user.findMany({ where: { role: 'COMMITTEE' }, orderBy: { email: 'asc' } });
  }

  async function holderOf(id: string) {
    const a = await openAssignment(id);
    return a ? userById(a.officerId) : null;
  }

  async function scheduleAndReport(id: string) {
    const desk = (await holderOf(id))!;
    const members = await committee();
    const visitDate = nextWorkingDayFrom(addDays(clock.today(), 1));
    let r = await act(app, desk, id, 'SCHEDULE_EVC', { payload: { memberIds: members.slice(0, 3).map((m) => m.id), visitDate: isoDate(visitDate), mode: 'ONLINE' } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    clock.setOverride(new Date(visitDate.getTime() + 10 * 3_600_000));
    const member = await userById(members[0]!.id);
    r = await act(app, member, id, 'SUBMIT_EVC_REPORT', {
      payload: { checklist: { land: true, building: true, labs: true, faculty: true, library: true }, recommendation: 'RECOMMEND_APPROVAL', reportText: 'Facilities match the application.' },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r;
  }

  it('enforces appeal authorization, 7-day window, one-appeal constraint, and appellate decision', async () => {
    const college = await userByEmail('college.abc@demo.in');
    const otherCollege = await userByEmail('college.002@demo.in');
    const s = await submitApp(app, college, { type: 'RESTORATION' });
    const id = s.body.application.id;
    await scheduleAndReport(id);

    const bureau = (await holderOf(id))!;
    const commUsers = await committee();
    await act(app, bureau, id, 'FORWARD_SAC_SHC', {
      payload: { note: 'Forwarded to SHC', memberIds: [commUsers[0]!.id, commUsers[1]!.id] },
    });

    // 2 recommendations meet quorum and advance to DECISION
    await act(app, await userById(commUsers[0]!.id), id, 'SUBMIT_RECOMMENDATION', { payload: { text: 'SHC rec 1' } });
    await act(app, await userById(commUsers[1]!.id), id, 'SUBMIT_RECOMMENDATION', { payload: { text: 'SHC rec 2' } });

    // Competent Authority rejects the application
    const authority = await userByEmail('authority.south@demo.in');
    const rejectRes = await act(app, authority, id, 'DECIDE', {
      reason: 'Land lease deficiency unresolved.',
      payload: { outcome: 'REJECTED' },
    });
    expect(rejectRes.status).toBe(200);
    expect((await prisma.application.findUniqueOrThrow({ where: { id } })).status).toBe('REJECTED');

    // 1. Unauthorized college cannot appeal
    const unauthRes = await request(app)
      .post(`/api/applications/${id}/appeal`)
      .set(...bearer(otherCollege))
      .send({ reason: 'Unauthorized institution appeal attempt.' });
    expect(unauthRes.status).toBe(403);

    // 2. Out-of-window appeal (advance time by 10 days, beyond statutory 7-day window)
    clock.setOverride(new Date(clock.now().getTime() + 10 * 86_400_000));
    const expiredRes = await request(app)
      .post(`/api/applications/${id}/appeal`)
      .set(...bearer(college))
      .send({ reason: 'We have rectified all land lease issues and request SAC review.' });
    expect(expiredRes.status).toBe(400);
    expect(expiredRes.body.error).toMatch(/7-day statutory appeal window/);

    // Reset clock back to within 7 days (e.g. 2 days post-rejection)
    clock.setOverride(new Date(clock.now().getTime() - 8 * 86_400_000));

    // 3. Valid appeal filed by college within window
    const appealRes = await request(app)
      .post(`/api/applications/${id}/appeal`)
      .set(...bearer(college))
      .send({ reason: 'We have attached a renewed registered 30-year lease deed.' });
    expect(appealRes.status).toBe(201);
    expect(appealRes.body.appeal.status).toBe('PENDING');
    const appealId = appealRes.body.appeal.id;

    // 4. One-appeal constraint: duplicate appeal is rejected
    const dupRes = await request(app)
      .post(`/api/applications/${id}/appeal`)
      .set(...bearer(college))
      .send({ reason: 'Trying to file a second appeal.' });
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toMatch(/An appeal has already been filed/);

    // 5. SAC appellate review: Authority/Bureau decides the appeal
    const decideAppealRes = await request(app)
      .post(`/api/applications/${id}/appeals/${appealId}/decide`)
      .set(...bearer(authority))
      .send({
        outcome: 'ACCEPTED',
        decisionReason: 'Renewed lease deed verified. Appeal allowed for reconsideration.',
      });
    expect(decideAppealRes.status).toBe(200);
    expect(decideAppealRes.body.appeal.status).toBe('ACCEPTED');

    // Verify appeal persistence and application status restored to DECISION
    const freshApp = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(freshApp.stage).toBe('DECISION');
    expect(freshApp.status).toBe('IN_STAGE');

    // Verify APPEAL_FILED and APPEAL_DECIDED audit records exist
    const audits = await prisma.auditLog.findMany({ where: { applicationId: id } });
    expect(audits.some((a) => a.action === 'APPEAL_FILED')).toBe(true);
    expect(audits.some((a) => a.action === 'APPEAL_DECIDED')).toBe(true);
  });
});
