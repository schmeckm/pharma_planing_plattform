import speakeasy from 'speakeasy';

export function generateSecret() {
  return speakeasy.generateSecret({ name: 'Prediction Portal' });
}

export function verifyToken(secret, token) {
  return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
}
