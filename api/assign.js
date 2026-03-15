import webpush from 'web-push';
import {
  createAssignment,
  deleteSubscriptionByEndpoint,
  getSubscriptionsByEmail
} from './_lib/googleSheets.js';

function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = process.env.PUSH_ADMIN_TOKEN;
  if (expectedToken && req.headers['x-admin-token'] !== expectedToken) {
    return unauthorized(res);
  }

  const email = req.body?.email?.trim().toLowerCase();
  const taskName = req.body?.taskName?.trim();
  const pdfUrl = req.body?.pdfUrl?.trim();
  const sourceRef = req.body?.sourceRef?.trim() || null;
  const baseUrl = (process.env.APP_URL || `https://${req.headers.host}`).replace(/\/$/, '');

  if (!email || !taskName || !pdfUrl) {
    return res.status(400).json({ error: 'Missing email, taskName or pdfUrl' });
  }

  try {
    const assignment = await createAssignment({
      email,
      taskName,
      pdfUrl,
      sourceRef
    });

    initVapid();

    const subscriptions = await getSubscriptionsByEmail(email);

    const url = `${baseUrl}/?assignment=${assignment.id}`;
    let success = 0;
    let failed = 0;

    await Promise.all(
      (subscriptions || []).map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        };

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: 'Task assignment',
              body: 'Please review important information before starting the task.',
              url
            })
          );
          success += 1;
        } catch (pushError) {
          failed += 1;

          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            await deleteSubscriptionByEndpoint(row.endpoint);
          }
        }
      })
    );

    return res.status(200).json({
      assignmentId: assignment.id,
      success,
      failed,
      email,
      url
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
