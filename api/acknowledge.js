import { acknowledgeAssignment } from './_lib/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const assignmentId = Number(req.body?.assignmentId);
  const email = req.body?.email?.trim().toLowerCase();

  if (!Number.isInteger(assignmentId) || assignmentId <= 0 || !email) {
    return res.status(400).json({ error: 'Missing assignmentId or email' });
  }

  let data;
  try {
    data = await acknowledgeAssignment({ assignmentId, email });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Assignment not found for this email' });
  }

  const ackWebhookUrl = process.env.GOOGLE_SHEETS_ACK_WEBHOOK_URL;
  if (ackWebhookUrl) {
    await fetch(ackWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        assignmentId: data.id,
        email: data.email,
        taskName: data.taskName,
        sourceRef: data.sourceRef,
        acknowledged: data.acknowledged,
        acknowledgedAt: data.acknowledgedAt
      })
    }).catch(() => null);
  }

  return res.status(200).json({
    ok: true,
    assignmentId: data.id,
    email: data.email,
    acknowledged: data.acknowledged,
    acknowledgedAt: data.acknowledged_at
  });
}
