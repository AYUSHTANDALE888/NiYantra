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

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

describe('Phase F: EVC History and Multi-Round Undertaking Evidence', () => {
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

  it('tracks durable EVC visit events across schedule, report, and revert', async () => {
    const college = await userByEmail('college.abc@demo.in');
    const s = await submitApp(app, college, { type: 'RESTORATION' });
    const id = s.body.application.id;

    const desk = (await holderOf(id))!;
    const members = await committee();
    const visitDate = nextWorkingDayFrom(addDays(clock.today(), 1));

    // Schedule EVC
    const schedRes = await act(app, desk, id, 'SCHEDULE_EVC', {
      payload: { memberIds: members.slice(0, 3).map((m) => m.id), visitDate: isoDate(visitDate), mode: 'ONLINE' },
    });
    expect(schedRes.status).toBe(200);

    let events = await prisma.evcVisitEvent.findMany({
      where: { applicationId: id },
      orderBy: { at: 'asc' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('SCHEDULED');
    expect(events[0].mode).toBe('ONLINE');

    // Submit report
    clock.setOverride(new Date(visitDate.getTime() + 10 * 3_600_000));
    const member = await userById(members[0]!.id);
    const repRes = await act(app, member, id, 'SUBMIT_EVC_REPORT', {
      payload: {
        checklist: { land: true, building: true, labs: true, faculty: true, library: true },
        recommendation: 'RECOMMEND_APPROVAL',
        reportText: 'All items verified on site.',
      },
    });
    expect(repRes.status).toBe(200);

    events = await prisma.evcVisitEvent.findMany({
      where: { applicationId: id },
      orderBy: { at: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events[1].action).toBe('REPORT_SUBMITTED');
    expect(events[1].reason).toBe('RECOMMEND_APPROVAL');

    // Case detail API reflects EVC history
    const detailRes = await request(app)
      .get(`/api/applications/${id}`)
      .set(...bearer(college));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.evcEvents).toHaveLength(2);
    expect(detailRes.body.evcEvents[0].action).toBe('SCHEDULED');
    expect(detailRes.body.evcEvents[1].action).toBe('REPORT_SUBMITTED');
  });

  async function verifier(applicationId: string) {
    const a = await prisma.assignment.findFirstOrThrow({ where: { applicationId, taskType: 'VERIFY', releasedAt: null } });
    return userById(a.officerId);
  }

  it('preserves multi-round undertaking evidence across rejection and resubmission', async () => {
    const college = await userByEmail('college.abc@demo.in');
    const authority = await userByEmail('authority.south@demo.in');

    // Create an application
    const s = await submitApp(app, college);
    const id = s.body.application.id;

    // Direct update to DECISION stage for test setup
    await prisma.application.update({
      where: { id },
      data: { stage: 'DECISION', status: 'IN_STAGE' },
    });

    const dueDate = isoDate(addDays(clock.today(), 30));
    const decideRes = await act(app, authority, id, 'DECIDE', {
      payload: {
        outcome: 'APPROVED_WITH_CONDITIONS',
        conditions: [{ condition: 'Provide occupancy certificate', dueDate }],
      },
      reason: 'Approved subject to occupancy certificate',
    });
    expect(decideRes.status).toBe(200);

    const undertaking = await prisma.undertaking.findFirstOrThrow({
      where: { applicationId: id },
    });
    expect(undertaking.status).toBe('OPEN');

    // Round 1: College uploads evidence
    const up1 = await request(app)
      .post(`/api/undertakings/${undertaking.id}/evidence`)
      .set(...bearer(college))
      .field('note', 'Round 1 submission')
      .attach('file', PDF, { filename: 'certificate_r1.pdf', contentType: 'application/pdf' });
    expect(up1.status).toBe(201);

    let rounds = await prisma.undertakingEvidenceRound.findMany({
      where: { undertakingId: undertaking.id },
      orderBy: { roundNumber: 'asc' },
    });
    expect(rounds).toHaveLength(1);
    expect(rounds[0].roundNumber).toBe(1);
    expect(rounds[0].verdict).toBe('PENDING');
    expect(rounds[0].remarks).toBe('Round 1 submission');

    // Round 1 Verification: Officer rejects
    const officer = await verifier(id);
    const rejRes = await request(app)
      .post(`/api/undertakings/${undertaking.id}/verify`)
      .set(...bearer(officer))
      .send({ accept: false, remarks: 'Certificate is blurry and missing seal' });
    expect(rejRes.status).toBe(200);

    rounds = await prisma.undertakingEvidenceRound.findMany({
      where: { undertakingId: undertaking.id },
      orderBy: { roundNumber: 'asc' },
    });
    expect(rounds).toHaveLength(1);
    expect(rounds[0].verdict).toBe('REJECTED');
    expect(rounds[0].remarks).toBe('Certificate is blurry and missing seal');

    const uAfterRej = await prisma.undertaking.findUniqueOrThrow({ where: { id: undertaking.id } });
    expect(uAfterRej.status).toBe('OPEN');

    // Round 2: College uploads clearer document
    const up2 = await request(app)
      .post(`/api/undertakings/${undertaking.id}/evidence`)
      .set(...bearer(college))
      .field('note', 'Round 2 submission with clear seal')
      .attach('file', PDF, { filename: 'certificate_r2.pdf', contentType: 'application/pdf' });
    expect(up2.status).toBe(201);

    rounds = await prisma.undertakingEvidenceRound.findMany({
      where: { undertakingId: undertaking.id },
      orderBy: { roundNumber: 'asc' },
    });
    expect(rounds).toHaveLength(2);
    expect(rounds[0].roundNumber).toBe(1);
    expect(rounds[0].verdict).toBe('REJECTED');
    expect(rounds[1].roundNumber).toBe(2);
    expect(rounds[1].verdict).toBe('PENDING');

    // Round 2 Verification: Officer accepts
    const officer2 = await verifier(id);
    const accRes = await request(app)
      .post(`/api/undertakings/${undertaking.id}/verify`)
      .set(...bearer(officer2))
      .send({ accept: true, remarks: 'Certificate verified successfully' });
    expect(accRes.status).toBe(200);

    rounds = await prisma.undertakingEvidenceRound.findMany({
      where: { undertakingId: undertaking.id },
      orderBy: { roundNumber: 'asc' },
    });
    expect(rounds).toHaveLength(2);
    expect(rounds[1].verdict).toBe('ACCEPTED');

    const uAfterAcc = await prisma.undertaking.findUniqueOrThrow({ where: { id: undertaking.id } });
    expect(uAfterAcc.status).toBe('VERIFIED');

    // Verify Case Detail returns full rounds history
    const detail = await request(app)
      .get(`/api/applications/${id}`)
      .set(...bearer(college));
    expect(detail.status).toBe(200);
    const uDetail = detail.body.undertakings.find((u: any) => u.id === undertaking.id);
    expect(uDetail.rounds).toHaveLength(2);
    expect(uDetail.rounds[0].verdict).toBe('REJECTED');
    expect(uDetail.rounds[1].verdict).toBe('ACCEPTED');

    // Verify /compliance returns rounds
    const compRes = await request(app)
      .get('/api/compliance')
      .set(...bearer(college));
    expect(compRes.status).toBe(200);
    const compU = compRes.body.undertakings.find((u: any) => u.id === undertaking.id);
    expect(compU.rounds).toHaveLength(2);
  });
});
