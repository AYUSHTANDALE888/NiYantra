// npm run setup: start the compose database (unless SETUP_NO_DOCKER=1), then migrate, seed and build the template.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.env.SETUP_NO_DOCKER !== '1') {
  run('docker compose up -d db');
}
run('npm --workspace api run prisma:generate');
run('npm --workspace api run setup:db');
