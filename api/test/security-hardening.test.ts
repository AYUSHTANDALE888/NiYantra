import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { resetDb, userByEmail, bearer } from './helpers.js';
import { submitApp } from './fixtures.js';
import { signToken } from '../src/auth/token.js';
import * as clock from '../src/lib/clock.js';

const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const SPOOFED_PDF = Buffer.from('Plain text masquerading as a PDF document');

describe('Phase H: Security Hardening', () => {
  let app: Express;

  beforeEach(async () => {
    await resetDb();
    app = createApp();
  });

  it('rejects files with invalid magic bytes even if MIME and extension claim to be PDF', async () => {
    const college = await userByEmail('college.abc@demo.in');
    const s = await submitApp(app, college);
    const appId = s.body.application.id;

    // 1. Valid PDF upload succeeds
    const okRes = await request(app)
      .post('/api/documents')
      .set(...bearer(college))
      .field('applicationId', appId)
      .field('kind', 'BUILDING_PLAN')
      .attach('file', VALID_PDF, { filename: 'valid_plan.pdf', contentType: 'application/pdf' });
    expect(okRes.status).toBe(201);

    // 2. Spoofed text file disguised as PDF is rejected
    const spoofRes = await request(app)
      .post('/api/documents')
      .set(...bearer(college))
      .field('applicationId', appId)
      .field('kind', 'BUILDING_PLAN')
      .attach('file', SPOOFED_PDF, { filename: 'spoofed_plan.pdf', contentType: 'application/pdf' });
    expect(spoofRes.status).toBe(400);
    expect(spoofRes.body.error).toContain('magic bytes mismatch');
  });

  it('denies cross-institution document download and audits DOCUMENT_DOWNLOADED for authorized downloads', async () => {
    const collegeSouth = await userByEmail('college.abc@demo.in');
    const westInst = await prisma.institution.findFirstOrThrow({ where: { region: { code: 'WEST' } } });
    const collegeWest = await prisma.user.findFirstOrThrow({ where: { institutionId: westInst.id, role: 'COLLEGE' } });

    const s = await submitApp(app, collegeSouth);
    const appId = s.body.application.id;

    const doc = await prisma.document.findFirstOrThrow({
      where: { applicationId: appId },
    });

    // 1. Cross-institution download is denied (College West cannot download College South's document)
    const deniedRes = await request(app)
      .get(`/api/documents/${doc.id}/download`)
      .set(...bearer(collegeWest));
    expect(deniedRes.status).toBe(404);

    // Verify access denied audit log
    const deniedAudit = await prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', actorId: collegeWest.id },
      orderBy: { id: 'desc' },
    });
    expect(deniedAudit).not.toBeNull();

    // 2. Authorized download succeeds and logs DOCUMENT_DOWNLOADED
    const okRes = await request(app)
      .get(`/api/documents/${doc.id}/download`)
      .set(...bearer(collegeSouth));
    expect(okRes.status).toBe(200);
    expect(okRes.headers['content-type']).toBe('application/pdf');

    const downloadAudit = await prisma.auditLog.findFirst({
      where: { action: 'DOCUMENT_DOWNLOADED', actorId: collegeSouth.id },
      orderBy: { id: 'desc' },
    });
    expect(downloadAudit).not.toBeNull();
    expect((downloadAudit?.meta as any)?.documentId).toBe(doc.id);
  });

  it('enforces maximum session age (24h) ceiling on token refresh', async () => {
    const user = await userByEmail('college.abc@demo.in');
    const nowSec = Math.floor(clock.now().getTime() / 1000);

    // 1. Token refreshed within 24h succeeds
    const validToken = signToken({ sub: user.id, role: user.role, authTime: nowSec - 3600 });
    const refreshOk = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${validToken}`);
    expect(refreshOk.status).toBe(200);
    expect(refreshOk.body.token).toBeDefined();

    // 2. Token refreshed past 24h is rejected
    const expiredSessionToken = signToken({ sub: user.id, role: user.role, authTime: nowSec - 25 * 3600 });
    const refreshExpired = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${expiredSessionToken}`);
    expect(refreshExpired.status).toBe(401);
    expect(refreshExpired.body.error).toContain('lifetime exceeded');
  });

  it('protects quick-login endpoint with DEMO_MODE production guard', async () => {
    // 1. In demo mode (default in test env), quick login succeeds
    const okRes = await request(app)
      .post('/api/auth/quick-login')
      .send({ email: 'college.abc@demo.in' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.token).toBeDefined();

    // 2. When DEMO_MODE is disabled, quick login is strictly rejected with 403 Forbidden
    const origDemoMode = process.env.DEMO_MODE;
    try {
      process.env.DEMO_MODE = 'false';
      const forbiddenRes = await request(app)
        .post('/api/auth/quick-login')
        .send({ email: 'college.abc@demo.in' });
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error).toContain('only available in demo mode');
    } finally {
      process.env.DEMO_MODE = origDemoMode;
    }
  });
});
