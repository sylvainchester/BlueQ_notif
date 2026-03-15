import { getAssignmentsByEmail } from './_lib/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = req.query?.email?.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const assignments = await getAssignmentsByEmail(email);
    return res.status(200).json({ email, assignments });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
