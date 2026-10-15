import { EMAIL_RE } from '@/lib/validation';

export const MIN_PASSWORD = 8;

/**
 * What to tell a shopper whose sign-in / sign-up failed.
 *
 * The API says exactly what is wrong ("Password must be at least 8 characters",
 * "Enter a valid email address"), and every failure used to be flattened into
 * "the email may already be registered — try signing in", which sent a new
 * customer with a short password to the sign-in tab (support #217). So:
 *   EMAIL_TAKEN        → the "already registered" wording, and only this code
 *   INVALID_CREDENTIALS→ the generic sign-in failure (deliberately vague)
 *   anything the API explained (4xx with a message) → that message, verbatim
 *   network / 5xx      → a plain "try again"
 */
export function authErrorMessage(e, mode) {
  if (e?.code === 'EMAIL_TAKEN') return 'An account already exists for that email. Try signing in instead.';
  if (e?.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
  if (e?.code === 'NETWORK') return e.message;
  if (e?.status >= 400 && e?.status < 500 && e?.message) return e.message;
  return mode === 'register'
    ? 'We couldn’t create your account just now. Please try again.'
    : 'We couldn’t sign you in just now. Please try again.';
}

/** Per-field problems for the sign-in / create-account forms; {} when fine. */
export function validateAuth({ email, password }, mode) {
  const e = {};
  if (!EMAIL_RE.test(String(email || '').trim())) e.email = 'Enter a valid email address.';
  if (mode === 'register') {
    if (String(password || '').length < MIN_PASSWORD) e.password = `Password must be at least ${MIN_PASSWORD} characters.`;
  } else if (!password) {
    e.password = 'Enter your password.';
  }
  return e;
}
