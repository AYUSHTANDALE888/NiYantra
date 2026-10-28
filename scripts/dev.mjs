// npm run dev: api, scheduler and web locally against the compose database; formcheck via uvicorn.
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const pythonCmd = isWin ? 'python' : 'python3';

const procs = [
  ['api', npmCmd, ['--workspace', 'api', 'run', 'dev']],
  ['scheduler', npmCmd, ['--workspace', 'api', 'run', 'dev:scheduler']],
  ['web', npmCmd, ['--workspace', 'web', 'run', 'dev']],
  ['formcheck', pythonCmd, ['-m', 'uvicorn', 'app.main:app', '--port', '8000', '--app-dir', 'formcheck']],
];

const children = procs.map(([name, cmd, args]) => {
  const p = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    env: { ...process.env, SHARED_DIR: new URL('../shared', import.meta.url).pathname },
  });
  const tag = `[${name}] `;
  p.stdout?.on('data', (d) => process.stdout.write(d.toString().replace(/^/gm, tag)));
  p.stderr?.on('data', (d) => process.stderr.write(d.toString().replace(/^/gm, tag)));
  p.on('error', (err) => console.log(`${tag}error: ${err.message}`));
  p.on('exit', (code) => console.log(`${tag}exited with ${code}`));
  return p;
});

process.on('SIGINT', () => {
  for (const c of children) c.kill('SIGINT');
  process.exit(0);
});
