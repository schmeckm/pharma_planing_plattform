export function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push('password.minLength');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('password.uppercase');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('password.lowercase');
  }
  if (!/[0-9]/.test(password || '')) {
    errors.push('password.number');
  }
  return { valid: errors.length === 0, errors };
}
