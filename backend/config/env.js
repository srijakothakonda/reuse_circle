export function loadConfig(env = process.env) {
  const missing = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'].filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  const nodeEnv = env.NODE_ENV || 'development';
  const cookieSecure = env.COOKIE_SECURE === 'true';
  const cookieSameSite = env.COOKIE_SAME_SITE || 'lax';
  if (!['lax', 'strict', 'none'].includes(cookieSameSite)) throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  if (cookieSameSite === 'none' && !cookieSecure) throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none');
  if (nodeEnv === 'production' && !cookieSecure) throw new Error('COOKIE_SECURE=true is required in production');
  return {
    port: Number(env.PORT || 5000), nodeEnv, mongoUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET, clientUrl: env.CLIENT_URL, cookieSecure,
    cookieSameSite, trustProxy: Number(env.TRUST_PROXY || 0)
  };
}
