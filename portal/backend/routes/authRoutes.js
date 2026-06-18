import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
import {
  loginWithPassword,
  loginWithGoogleProfile,
  refreshSession,
  revokeAccessToken,
  serializeUser,
} from '../services/authService.js';
import { revokeRefreshToken } from '../services/refreshTokenService.js';
import {
  buildGoogleAuthUrl,
  consumeExchangeCode,
  createExchangeCode,
  handleGoogleCallback,
  isGoogleConfigured,
} from '../services/oauthService.js';

const router = Router();

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return sendError(res, req, 400, 'errors.validation');
    }

    const session = await loginWithPassword(email, password);
    if (!session) {
      return sendError(res, req, 401, 'errors.invalidCredentials');
    }

    sendSuccess(res, {
      token: session.token,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  } catch (err) {
    console.error(err);
    sendError(res, req, 500, 'errors.internal');
  }
});

router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const session = await refreshSession(refreshToken);
    if (!session) {
      return sendError(res, req, 401, 'errors.unauthorized');
    }

    sendSuccess(res, {
      token: session.token,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  } catch (err) {
    console.error(err);
    sendError(res, req, 500, 'errors.internal');
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      await revokeAccessToken(token);
    }
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    sendSuccess(res, { ok: true });
  } catch (err) {
    console.error(err);
    sendError(res, req, 500, 'errors.internal');
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  sendSuccess(res, { user: serializeUser(req.user) });
});

router.get('/google', authLimiter, async (req, res) => {
  try {
    const redirectAfterLogin = typeof req.query.redirect === 'string' ? req.query.redirect : '/dashboard';

    if (!isGoogleConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        const { code } = createExchangeCode(
          {
            googleId: 'dev-google-user',
            email: 'user@localhost',
            displayName: 'Google Demo Benutzer',
            language: 'de',
          },
          redirectAfterLogin
        );
        return res.redirect(`${frontendBaseUrl()}/auth/callback?code=${code}`);
      }
      return sendError(res, req, 503, 'errors.googleNotConfigured');
    }

    const url = await buildGoogleAuthUrl(redirectAfterLogin);
    if (!url) {
      return sendError(res, req, 503, 'errors.googleNotConfigured');
    }
    return res.redirect(url);
  } catch (err) {
    console.error(err);
    sendError(res, req, 500, 'errors.internal');
  }
});

router.get('/google/callback', authLimiter, async (req, res) => {
  try {
    const { code, redirectAfterLogin } = await handleGoogleCallback(req.query);
    return res.redirect(`${frontendBaseUrl()}/auth/callback?code=${code}`);
  } catch (err) {
    console.error(err);
    const message = encodeURIComponent(err.message || 'OAuth fehlgeschlagen');
    return res.redirect(`${frontendBaseUrl()}/login?error=${message}`);
  }
});

router.post('/exchange', authLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    const entry = consumeExchangeCode(code);
    if (!entry) {
      return sendError(res, req, 401, 'errors.unauthorized');
    }

    const session = await loginWithGoogleProfile(entry.profile);
    sendSuccess(res, {
      token: session.token,
      refreshToken: session.refreshToken,
      user: session.user,
      redirect: entry.redirectAfterLogin,
    });
  } catch (err) {
    console.error(err);
    sendError(res, req, 500, 'errors.internal');
  }
});

router.post('/register', authLimiter, async (req, res) => {
  sendError(res, req, 501, 'errors.notImplemented');
});

router.post('/2fa/setup', authMiddleware, (req, res) => {
  sendError(res, req, 501, 'errors.notImplemented');
});

export default router;
