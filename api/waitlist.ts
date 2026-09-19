import type { IncomingMessage, ServerResponse } from 'http';

interface WaitlistBody {
  email?: string;
  source?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const body: WaitlistBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = (body.email || '').trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid developer email address.',
      });
    }

    return res.status(200).json({
      success: true,
      message: "You're on the waitlist. We'll invite you to the private beta soon.",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
  }
}
