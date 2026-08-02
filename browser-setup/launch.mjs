#!/usr/bin/env node

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;

function portIsOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: PORT });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}
if (!await portIsOpen()) {
  const child = spawn(process.execPath, [
    path.join(ROOT, 'browser-setup', 'server.mjs'),
    '--host', '0.0.0.0',
    '--port', String(PORT),
  ], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}
