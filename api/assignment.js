import { getAssignmentById } from './_lib/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = Number(req.query?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid assignment id' });
  }

  let data;
  try {
    data = await getAssignmentById(id);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  return res.status(200).json({
    id: data.id,
    email: data.email,
    taskName: data.taskName,
    pdfUrl: data.pdfUrl,
    assignedAt: data.assignedAt,
    acknowledged: data.acknowledged,
    acknowledgedAt: data.acknowledgedAt
  });
}
