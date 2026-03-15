import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = req.body?.email?.trim().toLowerCase();
  const subscription = req.body?.subscription;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription payload' });
  }

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      email,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers['user-agent'] || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
