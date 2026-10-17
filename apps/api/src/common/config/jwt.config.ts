export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || secret === 'super-secret-jwt-key' || secret === 'fallback_secret' || secret.includes('super-secret-jwt-key') || secret.includes('placeholder')) {
    if (isProd) {
      throw new Error(
        'FATAL: JWT_SECRET must be set to a strong, random secret in production environments and must not use known insecure default values.',
      );
    }
    // Return a dedicated dev secret only in development
    return secret || 'dev-only-local-jwt-secret-32-chars-long-min!';
  }

  if (secret.length < 32 && isProd) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long in production.');
  }

  return secret;
}
