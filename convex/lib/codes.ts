// Parent access-code helpers (FR-AUTH-2). Pure-ish: only Web Crypto
// (crypto.getRandomValues + crypto.subtle), available in the default Convex
// runtime and in edge-runtime tests. No Convex imports.

/**
 * Crockford base32 alphabet: 32 symbols, no ambiguous I, L, O, U.
 * 12 chars × 5 bits = 60 bits of entropy (FR-AUTH-2 requires ≥ 60).
 */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const CODE_LENGTH = 12;

/** Generate a raw access code formatted as "XXXX-XXXX-XXXX". */
export function generateRawCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Each byte mod 32 is uniform because 256 is a multiple of 32.
    code += CODE_ALPHABET[bytes[i] % 32];
  }
  return formatCode(code);
}

/**
 * Normalize user input to the canonical 12-char form: strip separators,
 * uppercase, and map Crockford-ambiguous chars (O→0, I→1, L→1).
 * Returns the normalized string (which may be invalid — see isValidCode).
 */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** True iff a normalized code has the exact shape we generate. */
export function isValidCode(normalized: string): boolean {
  if (normalized.length !== CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Format a normalized 12-char code as "XXXX-XXXX-XXXX" for display. */
export function formatCode(normalized: string): string {
  return [
    normalized.slice(0, 4),
    normalized.slice(4, 8),
    normalized.slice(8, 12),
  ].join("-");
}

/** SHA-256 hex digest of the normalized code. Only hashes are stored. */
export async function hashCode(normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
