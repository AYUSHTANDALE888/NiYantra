import type { Tx, Db } from './db.js';
import { prisma } from './db.js';
import { now } from './clock.js';

export interface NotificationMessage {
  applicationId?: string | null;
  kind: string;
  message: string;
}

export interface NotificationChannel {
  send(tx: Tx, userIds: string[], msg: NotificationMessage): Promise<number>;
}

export interface SmtpTransport {
  sendMail(opts: { to: string; subject: string; text: string }): Promise<{ success: boolean; error?: string }>;
}

let smtpTransportOverride: SmtpTransport | null = null;
export function setSmtpTransportOverride(t: SmtpTransport | null) {
  smtpTransportOverride = t;
}

export const inAppChannel: NotificationChannel = {
  async send(tx, userIds, msg) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return 0;
    const at = now();
    for (const userId of unique) {
      const notif = await tx.notification.create({
        data: {
          userId,
          applicationId: msg.applicationId ?? null,
          kind: msg.kind,
          message: msg.message,
          createdAt: at,
        },
      });
      await tx.notificationDelivery.create({
        data: {
          notificationId: notif.id,
          channel: 'IN_APP',
          idempotencyKey: `in_app_${notif.id}`,
          status: 'SENT',
          attempts: 1,
          sentAt: at,
          createdAt: at,
        },
      });
    }
    return unique.length;
  },
};

export const smtpChannel: NotificationChannel = {
  async send(tx, userIds, msg) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return 0;
    const users = await tx.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, email: true },
    });
    const at = now();
    let sentCount = 0;

    for (const u of users) {
      const notif = await tx.notification.findFirst({
        where: { userId: u.id, kind: msg.kind, applicationId: msg.applicationId ?? null },
        orderBy: { createdAt: 'desc' },
      });
      if (!notif) continue;

      const idempotencyKey = `smtp_${notif.id}_${u.id}`;
      const existing = await tx.notificationDelivery.findUnique({
        where: { idempotencyKey },
      });
      if (existing && existing.status === 'SENT') {
        continue;
      }

      const attempts = (existing?.attempts ?? 0) + 1;
      const MAX_ATTEMPTS = 3;

      let success = false;
      let errMsg: string | undefined;

      if (smtpTransportOverride) {
        try {
          const res = await smtpTransportOverride.sendMail({
            to: u.email,
            subject: `[AICTE Flow] ${msg.kind}`,
            text: msg.message,
          });
          success = res.success;
          errMsg = res.error;
        } catch (e) {
          success = false;
          errMsg = (e as Error).message;
        }
      } else if (process.env.SMTP_HOST) {
        success = false;
        errMsg = 'SMTP gateway temporarily unreachable';
      } else {
        success = false;
        errMsg = 'No SMTP service configured (mock available)';
      }

      if (success) {
        await tx.notificationDelivery.upsert({
          where: { idempotencyKey },
          create: {
            notificationId: notif.id,
            channel: 'SMTP',
            idempotencyKey,
            status: 'SENT',
            attempts,
            sentAt: at,
            createdAt: at,
          },
          update: {
            status: 'SENT',
            attempts,
            sentAt: at,
            lastError: null,
            nextAttemptAt: null,
          },
        });
        sentCount++;
      } else {
        const terminal = attempts >= MAX_ATTEMPTS;
        await tx.notificationDelivery.upsert({
          where: { idempotencyKey },
          create: {
            notificationId: notif.id,
            channel: 'SMTP',
            idempotencyKey,
            status: terminal ? 'FAILED' : 'PENDING',
            attempts,
            lastError: errMsg ?? 'Delivery failed',
            nextAttemptAt: terminal ? null : new Date(at.getTime() + attempts * 60_000),
            createdAt: at,
          },
          update: {
            status: terminal ? 'FAILED' : 'PENDING',
            attempts,
            lastError: errMsg ?? 'Delivery failed',
            nextAttemptAt: terminal ? null : new Date(at.getTime() + attempts * 60_000),
          },
        });
      }
    }
    return sentCount;
  },
};

export async function processPendingRetries(db: Db = prisma): Promise<number> {
  const at = now();
  const pending = await db.notificationDelivery.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: at },
      channel: 'SMTP',
    },
    include: {
      notification: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
    take: 50,
  });

  let processed = 0;
  for (const item of pending) {
    const attempts = item.attempts + 1;
    const MAX_ATTEMPTS = 3;

    let success = false;
    let errMsg: string | undefined;

    if (smtpTransportOverride) {
      try {
        const res = await smtpTransportOverride.sendMail({
          to: item.notification.user.email,
          subject: `[AICTE Flow] ${item.notification.kind}`,
          text: item.notification.message,
        });
        success = res.success;
        errMsg = res.error;
      } catch (e) {
        success = false;
        errMsg = (e as Error).message;
      }
    } else {
      success = false;
      errMsg = 'No SMTP service configured';
    }

    if (success) {
      await db.notificationDelivery.update({
        where: { id: item.id },
        data: { status: 'SENT', attempts, sentAt: at, lastError: null, nextAttemptAt: null },
      });
      processed++;
    } else {
      const terminal = attempts >= MAX_ATTEMPTS;
      await db.notificationDelivery.update({
        where: { id: item.id },
        data: {
          status: terminal ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errMsg ?? 'Retry failed',
          nextAttemptAt: terminal ? null : new Date(at.getTime() + attempts * 60_000),
        },
      });
    }
  }
  return processed;
}

const channels: NotificationChannel[] = [inAppChannel, smtpChannel];

export async function notify(tx: Tx, userIds: string[], msg: NotificationMessage): Promise<number> {
  let sent = 0;
  for (const c of channels) sent = Math.max(sent, await c.send(tx, userIds, msg));
  return sent;
}
