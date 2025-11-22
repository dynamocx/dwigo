const windowTrackers = new Map();

const cleanupExpired = (now) => {
  for (const [key, tracker] of windowTrackers.entries()) {
    if (tracker.expiresAt <= now) {
      windowTrackers.delete(key);
    }
  }
};

const canPerformAction = (key, { windowMs, maxAttempts }) => {
  const now = Date.now();
  cleanupExpired(now);

  const existing = windowTrackers.get(key);
  if (existing && existing.expiresAt > now) {
    if (existing.count >= maxAttempts) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  windowTrackers.set(key, {
    count: 1,
    expiresAt: now + windowMs,
  });
  return true;
};

module.exports = {
  canPerformAction,
};

