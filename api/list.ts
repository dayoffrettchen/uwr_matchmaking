import { VercelRequest, VercelResponse } from '@vercel/node';
import { signups } from '../src/bot';

export default (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const day = req.query.day as string;

  if (!day || !['monday', 'friday'].includes(day.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid day parameter' });
  }

  const dayLower = day.toLowerCase();
  const players = signups[dayLower];

  return res.status(200).json({
    day: dayLower,
    count: players.length,
    players: players.map(p => ({
      phone: p.phone,
      timestamp: p.timestamp
    }))
  });
};
