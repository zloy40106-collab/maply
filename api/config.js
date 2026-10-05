module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  // Only a PUBLIC publishable key is allowed through this endpoint.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    return res.status(503).json({ error: 'В Vercel укажи SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY, затем сделай Redeploy.' });
  }
  return res.status(200).json({ url, key });
};
