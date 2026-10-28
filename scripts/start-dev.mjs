import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting CodeSense Copilot (Backend & Frontend)...\n');

const isWin = process.platform === 'win32';
const npmExe = isWin ? 'npm.cmd' : 'npm';

// Start Server
const server = spawn(npmExe, ['run', 'dev'], {
  cwd: path.resolve('server'),
  stdio: 'inherit'
});

// Start Frontend
const frontend = spawn(npmExe, ['run', 'dev'], {
  cwd: path.resolve('frontend'),
  stdio: 'inherit'
});

const cleanup = () => {
  console.log('\n🛑 Shutting down services...');
  server.kill();
  frontend.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
