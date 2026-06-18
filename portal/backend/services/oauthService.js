import crypto from 'crypto';
import { Issuer, generators } from 'openid-client';

const exchangeCodes = new Map();
const oauthStates = new Map();

const EXCHANGE_TTL_MS = 5 * 60_000;
const STATE_TTL_MS = 10 * 60_000;

let googleClientPromise = null;

function pruneMap(map) {
  const now = Date.now();
  for (const [key, value] of map.entries()) {
    if (value.expiresAt <= now) {
      map.delete(key);
    }
  }
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function getGoogleClient() {
  if (!isGoogleConfigured()) {
    return null;
  }
  if (!googleClientPromise) {
    googleClientPromise = (async () => {
      const issuer = await Issuer.discover('https://accounts.google.com');
      return new issuer.Client({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uris: [process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'],
        response_types: ['code'],
      });
    })();
  }
  return googleClientPromise;
}

export async function buildGoogleAuthUrl(redirectAfterLogin) {
  const client = await getGoogleClient();
  if (!client) {
    return null;
  }

  pruneMap(oauthStates);
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  oauthStates.set(state, {
    codeVerifier,
    redirectAfterLogin: redirectAfterLogin || '/dashboard',
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  return client.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

export async function handleGoogleCallback(query) {
  const client = await getGoogleClient();
  if (!client) {
    throw new Error('Google SSO nicht konfiguriert');
  }

  const state = query.state;
  const stateEntry = oauthStates.get(state);
  if (!stateEntry || stateEntry.expiresAt < Date.now()) {
    throw new Error('OAuth-State ungültig oder abgelaufen');
  }
  oauthStates.delete(state);

  const params = client.callbackParams({ query });
  const tokenSet = await client.callback(
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    params,
    { code_verifier: stateEntry.codeVerifier, state }
  );

  const claims = tokenSet.claims();
  const profile = {
    googleId: claims.sub,
    email: claims.email,
    displayName: claims.name || claims.email,
    language: typeof claims.locale === 'string' ? claims.locale.slice(0, 2) : 'de',
  };

  return createExchangeCode(profile, stateEntry.redirectAfterLogin);
}

export function createExchangeCode(profile, redirectAfterLogin = '/dashboard') {
  pruneMap(exchangeCodes);
  const code = crypto.randomBytes(24).toString('hex');
  exchangeCodes.set(code, {
    profile,
    redirectAfterLogin,
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  });
  return { code, redirectAfterLogin };
}

export function consumeExchangeCode(code) {
  pruneMap(exchangeCodes);
  const entry = exchangeCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    exchangeCodes.delete(code);
    return null;
  }
  exchangeCodes.delete(code);
  return entry;
}

export async function completeOAuth(_provider) {
  return null;
}
