import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    success: true, 
    message: 'Vercel Serverless Function is working',
    runtime: 'nodejs18.x',
    timestamp: new Date().toISOString()
  });
}
