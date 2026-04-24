import type { VercelRequest, VercelResponse } from '@vercel/node';
import { baseHandler } from './lib/handlerFactory';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return await baseHandler(req, res, 'EligibilityRule', 'eligibility_rules');
}
