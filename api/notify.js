import webpush from 'web-push';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

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

  const title = req.body?.title || 'BlueQ';
  const body = req.body?.body || 'Nouvelle notification';
  const url = req.body?.url || '/';

  try {
    initVapid();

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data?.length) {
      return res.status(200).json({ success: 0, failed: 0, message: 'No subscriptions' });
    }

    let success = 0;
    let failed = 0;

    await Promise.all(
      data.map(async (row) => {
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
              title,
              body,
              url
            })
          );
          success += 1;
        } catch (pushError) {
          failed += 1;

          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          }
        }
      })
    );

    return res.status(200).json({ success, failed });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
