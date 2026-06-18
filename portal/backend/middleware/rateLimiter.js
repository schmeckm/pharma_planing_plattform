import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const leaderboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 200,
});

export const displayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 120 : 500,
});
