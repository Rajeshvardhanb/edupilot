// Reuses an existing .next-test build for local SMTP integration verification.
import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';
try { loadEnvFile('.env'); } catch {}
const url = new URL(process.env.DATABASE_URL); url.pathname = '/edupilot_test';
const server = spawn(process.execPath, ['scripts/test-smtp.mjs', process.execPath, 'node_modules/next/dist/bin/next', 'start', '-p', '3100'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: url.toString(), NEXT_DIST_DIR: '.next-test', APP_URL: 'http://localhost:3100' },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', code => process.exit(code ?? 0));
