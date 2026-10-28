import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { resetDb, userByEmail, bearer } from './helpers.js';
import { notify, setSmtpTransportOverride, processPendingRetries } from '../src/lib/notify.js';
import * as clock from '../src/lib/clock.js';

describe('Phase E: Notification Delivery, SMTP and Retries', () => {
  let app: Express;

  beforeEach(async () => {
    await resetDb();
    app = createApp();
    setSmtpTransportOverride(null);
  });

  it('persists in-app deliveries and handles successful SMTP deliveries', async () => {
    const user = await userByEmail('college.abc@demo.in');

    const sentEmails: any[] = [];
    setSmtpTransportOverride({
      async sendMail(opts) {
        sentEmails.push(opts);
        return { success: true };
      },
    });

    await prisma.$transaction(async (tx) => {
      await notify(tx, [user.id], {
        kind: 'APPLICATION_STATUS_UPDATE',
        message: 'Your application has been received.',
      });
    });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(user.email);

    // Verify In-App delivery
    const inAppDelivery = await prisma.notificationDelivery.findFirst({
      where: { channel: 'IN_APP' },
      include: { notification: true },
    });
    expect(inAppDelivery).not.toBeNull();
    expect(inAppDelivery?.status).toBe('SENT');
    expect(inAppDelivery?.attempts).toBe(1);
    expect(inAppDelivery?.notification.userId).toBe(user.id);

    // Verify SMTP delivery
    const smtpDelivery = await prisma.notificationDelivery.findFirst({
      where: { channel: 'SMTP' },
      include: { notification: true },
    });
    expect(smtpDelivery).not.toBeNull();
    expect(smtpDelivery?.status).toBe('SENT');
    expect(smtpDelivery?.attempts).toBe(1);
    expect(smtpDelivery?.sentAt).not.toBeNull();
  });

  it('handles bounded SMTP retries, marks terminal FAILED, and prevents duplicates', async () => {
    const user = await userByEmail('college.abc@demo.in');

    let failSmtp = true;
    setSmtpTransportOverride({
      async sendMail() {
        if (failSmtp) {
          return { success: false, error: 'SMTP connection timeout' };
        }
        return { success: true };
      },
    });

    // Step 1: Initial notification triggers attempt 1 -> PENDING
    await prisma.$transaction(async (tx) => {
      await notify(tx, [user.id], {
        kind: 'DEFICIENCY_ALERT',
        message: 'Deficiency letter uploaded.',
      });
    });

    let delivery = await prisma.notificationDelivery.findFirst({
      where: { channel: 'SMTP' },
    });
    expect(delivery).not.toBeNull();
    expect(delivery?.status).toBe('PENDING');
    expect(delivery?.attempts).toBe(1);
    expect(delivery?.lastError).toBe('SMTP connection timeout');
    expect(delivery?.nextAttemptAt).not.toBeNull();

    // Step 2: Retry 1 (attempt 2)
    clock.setOverride(new Date(clock.now().getTime() + 70_000));
    await processPendingRetries();

    delivery = await prisma.notificationDelivery.findFirst({
      where: { channel: 'SMTP' },
    });
    expect(delivery?.status).toBe('PENDING');
    expect(delivery?.attempts).toBe(2);

    // Step 3: Retry 2 (attempt 3 - MAX reached) -> terminal FAILED
    clock.setOverride(new Date(clock.now().getTime() + 140_000));
    await processPendingRetries();

    delivery = await prisma.notificationDelivery.findFirst({
      where: { channel: 'SMTP' },
    });
    expect(delivery?.status).toBe('FAILED');
    expect(delivery?.attempts).toBe(3);
    expect(delivery?.lastError).toBe('SMTP connection timeout');

    // Step 4: Admin endpoint exposes failed deliveries
    const admin = await userByEmail('admin@demo.in');
    const adminRes = await request(app)
      .get('/api/admin/notifications/failed')
      .set(...bearer(admin));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.failed).toHaveLength(1);
    expect(adminRes.body.failed[0].recipient.email).toBe(user.email);
    expect(adminRes.body.failed[0].attempts).toBe(3);
    expect(adminRes.body.failed[0].lastError).toBe('SMTP connection timeout');

    // Non-admin receives 403
    const nonAdminRes = await request(app)
      .get('/api/admin/notifications/failed')
      .set(...bearer(user));
    expect(nonAdminRes.status).toBe(403);
  });
});
