import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { resetDb, userByEmail, bearer } from './helpers.js';
import { submitApp, act } from './fixtures.js';
import { escapeCsvCell } from '../src/routes/reports.js';
import { addDays, isoDate } from '../src/lib/dates.js';
import * as clock from '../src/lib/clock.js';

describe('Phase G: Role-Scoped Report Exports and Security', () => {
  let app: Express;

  beforeEach(async () => {
    await resetDb();
    app = createApp();
  });

  it('escapes CSV cells against formula injection attacks', () => {
    expect(escapeCsvCell('=1+1')).toBe(`'=1+1`);
    expect(escapeCsvCell('+cmd')).toBe(`'+cmd`);
    expect(escapeCsvCell('-SUM(A1:A10)')).toBe(`'-SUM(A1:A10)`);
    expect(escapeCsvCell('@calc')).toBe(`'@calc`);
    expect(escapeCsvCell('Normal Text')).toBe('Normal Text');
    expect(escapeCsvCell('Text with, comma')).toBe('"Text with, comma"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('exports CSV reports with correct headers, MIME types, and logs REPORT_EXPORTED', async () => {
    const admin = await userByEmail('admin@demo.in');
    const college = await userByEmail('college.abc@demo.in');

    // Submit an application so there is data
    await submitApp(app, college);

    // Test pendency export
    const pendencyRes = await request(app)
      .get('/api/reports/pendency.csv')
      .set(...bearer(admin));
    expect(pendencyRes.status).toBe(200);
    expect(pendencyRes.headers['content-type']).toContain('text/csv');
    expect(pendencyRes.headers['content-disposition']).toContain('attachment; filename="pendency-');
    expect(pendencyRes.text).toContain('Application No,Institution,Region,Type,Stage,Days in Stage,Assigned Officer,Open Items Count');

    // Test audit log entry
    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'REPORT_EXPORTED', actorId: admin.id },
      orderBy: { id: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect((auditRow?.meta as any)?.report).toBe('pendency');

    // Test other 5 CSV reports
    const evcRes = await request(app).get('/api/reports/evc.csv').set(...bearer(admin));
    expect(evcRes.status).toBe(200);
    expect(evcRes.headers['content-type']).toContain('text/csv');
    expect(evcRes.text).toContain('Application No,Institution,Region,EVC Status');

    const compRes = await request(app).get('/api/reports/compliance.csv').set(...bearer(admin));
    expect(compRes.status).toBe(200);
    expect(compRes.headers['content-type']).toContain('text/csv');
    expect(compRes.text).toContain('Application No,Institution,Region,Condition,Due Date,Status');

    const valRes = await request(app).get('/api/reports/validity.csv').set(...bearer(admin));
    expect(valRes.status).toBe(200);
    expect(valRes.headers['content-type']).toContain('text/csv');
    expect(valRes.text).toContain('Application No,Institution,Region,Approval Outcome,Decided Date');

    const overdueRes = await request(app).get('/api/reports/overdue.csv').set(...bearer(admin));
    expect(overdueRes.status).toBe(200);
    expect(overdueRes.headers['content-type']).toContain('text/csv');
    expect(overdueRes.text).toContain('Application No,Institution,Region,Item Type,Due Date,Days Overdue');

    const procRes = await request(app).get('/api/reports/processing-time.csv').set(...bearer(admin));
    expect(procRes.status).toBe(200);
    expect(procRes.headers['content-type']).toContain('text/csv');
    expect(procRes.text).toContain('Application No,Institution,Region,Type,Final Status,Submitted At,Decided At');
  });

  it('enforces role-scoped data isolation across regions and institutions', async () => {
    const collegeSouth = await userByEmail('college.abc@demo.in'); // South region
    const westInst = await prisma.institution.findFirstOrThrow({ where: { region: { code: 'WEST' } } });
    const collegeWest = await prisma.user.findFirstOrThrow({ where: { institutionId: westInst.id, role: 'COLLEGE' } });

    const s1 = await submitApp(app, collegeSouth);
    const s2 = await submitApp(app, collegeWest);
    const appSouthNo = s1.body.application.applicationNo;
    const appWestNo = s2.body.application.applicationNo;

    // 1. College South only sees own application in pendency report
    const collegeRes = await request(app)
      .get('/api/reports/pendency.csv')
      .set(...bearer(collegeSouth));
    expect(collegeRes.status).toBe(200);
    expect(collegeRes.text).toContain(appSouthNo);
    expect(collegeRes.text).not.toContain(appWestNo);

    // 2. Regional Officer (South) only sees South region applications
    const roSouth = await userByEmail('priya@demo.in'); // South officer
    const roRes = await request(app)
      .get('/api/reports/pendency.csv')
      .set(...bearer(roSouth));
    expect(roRes.status).toBe(200);
    expect(roRes.text).toContain(appSouthNo);
    expect(roRes.text).not.toContain(appWestNo);

    // 3. Central Bureau / Admin sees both South and West applications
    const bureau = await prisma.user.create({
      data: {
        email: 'bureau.test@demo.in',
        name: 'Bureau Test Officer',
        role: 'BUREAU',
        passwordHash: 'dummy',
      },
    });
    const bureauRes = await request(app)
      .get('/api/reports/pendency.csv')
      .set(...bearer(bureau));
    expect(bureauRes.status).toBe(200);
    expect(bureauRes.text).toContain(appSouthNo);
    expect(bureauRes.text).toContain(appWestNo);
  });
});
