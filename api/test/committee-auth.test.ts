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

describe('Phase C: Committee authorization, recusal and quorum', () => {
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

  it('enforces membership, recusal, duplicate prevention and quorum', async () => {
    const college = await userByEmail('college.abc@demo.in');
    const s = await submitApp(app, college, { type: 'RESTORATION' });
    const id = s.body.application.id;
    await scheduleAndReport(id);

    const app1 = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(app1.stage).toBe('SAC_SHC');

    const bureau = (await holderOf(id))!;
    expect(bureau.role).toBe('BUREAU');

    const commUsers = await committee();
    const appointedMember1 = await userById(commUsers[0]!.id);
    const appointedMember2 = await userById(commUsers[1]!.id);
    const recusedMember = await userById(commUsers[2]!.id);

    // Forward to SAC_SHC appointing only members 1, 2, and 3
    const forwardRes = await act(app, bureau, id, 'FORWARD_SAC_SHC', {
      payload: {
        note: 'Forwarded to committee panel',
        memberIds: [appointedMember1.id, appointedMember2.id, recusedMember.id],
      },
    });
    expect(forwardRes.status).toBe(200);

    // Verify non-appointed committee member gets 403
    const nonAppointedMember = await userById(commUsers[3]!.id);
    const nonMemberRes = await act(app, nonAppointedMember, id, 'SUBMIT_RECOMMENDATION', {
      payload: { text: 'I am not appointed but trying to recommend.' },
    });
    expect(nonMemberRes.status).toBe(403);

    // Verify ACCESS_DENIED is audited
    const deniedAudit = await prisma.auditLog.findFirst({
      where: { applicationId: id, actorId: nonAppointedMember.id, action: 'ACCESS_DENIED' },
    });
    expect(deniedAudit).toBeTruthy();

    // Recuse member 3 via recusal in DB
    await prisma.committeeMembership.update({
      where: { applicationId_userId_committeeRole: { applicationId: id, userId: recusedMember.id, committeeRole: 'SAC_SHC' } },
      data: { recused: true, recusedReason: 'Conflict of interest: former alumnus' },
    });

    // Verify recused member gets 403
    const recusedRes = await act(app, recusedMember, id, 'SUBMIT_RECOMMENDATION', {
      payload: { text: 'Recused recommendation attempt' },
    });
    expect(recusedRes.status).toBe(403);

    // Member 1 recommends -> Success, but 1 member does NOT advance stage (quorum is 2)
    const rec1 = await act(app, appointedMember1, id, 'SUBMIT_RECOMMENDATION', {
      payload: { text: 'First recommendation: approve restoration.' },
    });
    expect(rec1.status).toBe(200);
    const stageAfter1 = (await prisma.application.findUniqueOrThrow({ where: { id } })).stage;
    expect(stageAfter1).toBe('SAC_SHC');

    // Duplicate recommendation by member 1 is rejected with 403
    const dupRes = await act(app, appointedMember1, id, 'SUBMIT_RECOMMENDATION', {
      payload: { text: 'Trying duplicate recommendation.' },
    });
    expect(dupRes.status).toBe(403);

    // Member 2 recommends -> Quorum reached -> Stage advances to DECISION
    const rec2 = await act(app, appointedMember2, id, 'SUBMIT_RECOMMENDATION', {
      payload: { text: 'Second recommendation: concurring.' },
    });
    expect(rec2.status).toBe(200);
    const stageAfter2 = (await prisma.application.findUniqueOrThrow({ where: { id } })).stage;
    expect(stageAfter2).toBe('DECISION');

    // Committee status endpoint returns accurate quorum and member status
    const committeeStatusRes = await request(app)
      .get(`/api/applications/${id}/committee`)
      .set(...bearer(appointedMember1));
    expect(committeeStatusRes.status).toBe(200);
    expect(committeeStatusRes.body.quorum).toBe(2);
    expect(committeeStatusRes.body.recommendationsCount).toBe(2);
    expect(committeeStatusRes.body.quorumReached).toBe(true);
    expect(committeeStatusRes.body.members.length).toBe(3);
  });
});
