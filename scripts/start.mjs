import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function waitForPort(port, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error('The data file server did not start.'));
          return;
        }
        setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

const fileServer = spawn(process.execPath, ['server/tracker-file.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

let angular;

function stop() {
  angular?.kill('SIGTERM');
  fileServer.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  await waitForPort(4300);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop();
  process.exit(1);
}

angular = spawn(process.execPath, [
  'node_modules/@angular/cli/bin/ng.js',
  'serve',
  '--host',
  '127.0.0.1',
  '--port',
  '4200',
], {
  cwd: root,
  stdio: 'inherit',
});

await new Promise((resolve) => angular.on('exit', resolve));
fileServer.kill('SIGTERM');
process.exit(0);
