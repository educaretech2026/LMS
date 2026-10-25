import * as fs from 'fs';
import * as path from 'path';

/**
 * Strips surrounding quotes (single or double) and trims whitespace.
 */
export function cleanEnvValue(val: string | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Automatically discovers and loads .env files into process.env if not already populated.
 * Recursively scans upward from process.cwd() and __dirname up to 6 parent directories.
 */
export function loadEnv(): void {
  const startDirs = [process.cwd(), __dirname];
  const candidateDirs = new Set<string>();

  for (const start of startDirs) {
    let curr = path.resolve(start);
    for (let i = 0; i < 6; i++) {
      candidateDirs.add(curr);
      candidateDirs.add(path.join(curr, 'apps', 'api'));
      candidateDirs.add(path.join(curr, 'packages', 'database'));
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
  }

  const candidateFiles = ['.env', '.env.local', '.env.production'];

  for (const dir of candidateDirs) {
    for (const file of candidateFiles) {
      try {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          applyEnvContent(content);
        }
      } catch {
        // Silently skip inaccessible paths
      }
    }
  }

  // Also sanitize and strip any quotes from existing Cloudflare & service env variables
  const keysToClean = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'R2_ACCOUNT_ID',
    'CLOUDFLARE_STREAM_API_TOKEN',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'R2_ACCESS_KEY_ID',
    'CLOUDFLARE_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'R2_BUCKET_NAME',
    'CLOUDFLARE_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_DOMAIN',
    'R2_PUBLIC_DOMAIN',
    'CLOUDFLARE_PUBLIC_DOMAIN',
    'LIVEKIT_WS_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
  ];

  for (const key of keysToClean) {
    if (process.env[key]) {
      process.env[key] = cleanEnvValue(process.env[key]);
    }
  }
}

function applyEnvContent(content: string): void {
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();
    const val = cleanEnvValue(rawVal);

    // Only set if not already set or empty
    if (!process.env[key] || process.env[key]?.trim() === '') {
      process.env[key] = val;
    }
  }
}

// Auto-run on initial module evaluation
loadEnv();
