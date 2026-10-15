/** Shared format checks. Pure, so any component or lib file may import them. */

/** Deliberately the same shape the API enforces: something@something.tld, no spaces, one @. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** US ZIP or ZIP+4. */
export const ZIP_RE = /^\d{5}(-\d{4})?$/;
