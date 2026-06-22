/**
 * Extracts a displayable error string from an API response error value.
 * The backend may return `error` as:
 *  - a string: "Invalid credentials"
 *  - an object: { email: ["Email already exists."] }
 *  - an empty object: {}
 *  - null/undefined
 *
 * This function always returns a string safe for React rendering.
 */
export function extractErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (!error) return fallback;

  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    // If it has a 'message' key, use that
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }

    // Flatten object values like { email: ["Already exists"], name: ["Required"] }
    const values = Object.values(error as Record<string, unknown>);
    if (values.length === 0) return fallback;

    const messages: string[] = [];
    for (const val of values) {
      if (typeof val === 'string') {
        messages.push(val);
      } else if (Array.isArray(val)) {
        messages.push(...val.filter((v) => typeof v === 'string'));
      }
    }
    return messages.length > 0 ? messages.join('. ') : fallback;
  }

  return String(error);
}
