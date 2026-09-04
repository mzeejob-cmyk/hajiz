function decodeBase64UrlUtf8(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('MALFORMED_JWT');
  const remainder = value.length % 4;
  if (remainder === 1) throw new Error('MALFORMED_JWT');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - remainder) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function validateLegacySupabaseKey(value, expectedProject, expectedRole) {
  if (typeof value !== 'string' || value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')) return false;
  const segments = value.split('.');
  if (segments.length !== 3 || segments.some(segment => segment.length === 0)) return false;
  try {
    const claims = JSON.parse(decodeBase64UrlUtf8(segments[1]));
    return claims !== null && typeof claims === 'object' &&
      claims.ref === expectedProject && claims.role === expectedRole;
  } catch {
    return false;
  }
}
