// Fixed-window limiter, in-memory. The app runs as a single instance, so a
// shared store would be premature — but this is per-process, so it stops
// counting correctly the moment the service is scaled out.

export function rateLimit({ windowMs, max, key = ipOf, message }) {
  const hits = new Map();

  // Drop expired windows periodically so the map can't grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) {
      if (now > entry.resetAt) hits.delete(k);
    }
  }, windowMs);
  sweep.unref?.();

  return function limiter(req, res, next) {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        error: message || 'Too many requests — please wait a moment and try again.',
      });
    }

    next();
  };
}

// Railway terminates TLS upstream, so the client address is only in the
// forwarded header. It is client-controlled and therefore spoofable — good
// enough to stop casual scraping, not a defense against a determined attacker.
function ipOf(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
