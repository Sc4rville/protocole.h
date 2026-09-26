import { director } from '../server/director-core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { out } = await director(body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
