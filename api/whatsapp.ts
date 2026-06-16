import { VercelRequest, VercelResponse } from '@vercel/node';
import { processMessage } from '../src/bot';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { Body, From } = req.body;

    if (!Body || !From) {
      return res.status(400).json({ error: 'Missing Body or From' });
    }

    await processMessage(From, Body);
    return res.status(200).send('');
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
