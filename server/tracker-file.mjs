import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.TRACKER_DIR ? path.resolve(process.env.TRACKER_DIR) : path.join(root, 'data');
const legacyFile = path.join(dataDir, 'tracker.json');
const accountsFile = path.join(dataDir, 'accounts.json');
const usersDir = path.join(dataDir, 'users');
const port = Number(process.env.TRACKER_PORT ?? 4300);
const maxBytes = 2 * 1024 * 1024;

const LISTS = ['habits', 'completions', 'entries', 'goals', 'achievements'];
const THEMES = ['dark', 'light', 'system'];
const USER_ID = /^[a-z0-9]{8,40}$/;
const ACCOUNT_FIELDS = ['id', 'name', 'username', 'passwordHash', 'salt', 'recoveryHash', 'recoverySalt', 'createdAt'];

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTracker(value) {
  if (!isRecord(value)) {
    throw new Error('Invalid tracker file.');
  }
  const document = {};
  for (const key of LISTS) {
    document[key] = Array.isArray(value[key]) ? value[key] : [];
  }
  const displayName = typeof value.settings?.displayName === 'string' ? value.settings.displayName.slice(0, 40) : '';
  const theme = THEMES.includes(value.settings?.theme) ? value.settings.theme : 'dark';
  document.settings = { displayName, theme };
  document.meta = { seeded: Boolean(value.meta?.seeded) };
  return document;
}

function normalizeAccounts(value) {
  if (!isRecord(value)) {
    throw new Error('Invalid accounts file.');
  }
  const accounts = (Array.isArray(value.accounts) ? value.accounts : [])
    .filter((account) => isRecord(account)
      && ACCOUNT_FIELDS.every((field) => typeof account[field] === 'string')
      && USER_ID.test(account.id))
    .map((account) => ({
      ...Object.fromEntries(ACCOUNT_FIELDS.map((field) => [field, account[field]])),
      biometric: account.biometric === true,
    }));
  return { accounts, legacyClaimed: value.legacyClaimed === true };
}

function readJson(file, normalize, fallback) {
  try {
    return normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return normalize(fallback);
    }
    throw error;
  }
}

function writeJson(file, document) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function readBody(request, response, onBody) {
  const chunks = [];
  let size = 0;
  let rejected = false;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBytes) {
      rejected = true;
      send(response, 413, { error: 'The data file is too large.' });
      request.destroy();
    } else {
      chunks.push(chunk);
    }
  });
  request.on('end', () => {
    if (rejected || response.writableEnded) {
      return;
    }
    try {
      onBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      send(response, 400, { error: 'The data file could not be updated.' });
    }
  });
}

function route(url) {
  if (url === '/api/accounts') {
    return { file: accountsFile, normalize: normalizeAccounts, writable: true };
  }
  if (url === '/api/legacy') {
    return { file: legacyFile, normalize: normalizeTracker, writable: false };
  }
  const match = /^\/api\/users\/([^/]+)$/.exec(url ?? '');
  if (match && USER_ID.test(match[1])) {
    return { file: path.join(usersDir, `${match[1]}.json`), normalize: normalizeTracker, writable: true, deletable: true };
  }
  return null;
}

const server = http.createServer((request, response) => {
  const target = route(request.url?.split('?')[0]);
  if (!target) {
    send(response, 404, { error: 'Not found.' });
    return;
  }
  if (request.method === 'GET') {
    try {
      send(response, 200, readJson(target.file, target.normalize, {}));
    } catch {
      send(response, 500, { error: 'Could not read the data file.' });
    }
    return;
  }
  if (request.method === 'DELETE' && target.deletable) {
    fs.rm(target.file, { force: true }, (error) => send(response, error ? 500 : 200, { ok: !error }));
    return;
  }
  if (request.method !== 'PUT' || !target.writable) {
    send(response, 405, { error: 'Method not allowed.' });
    return;
  }
  readBody(request, response, (body) => {
    const document = target.normalize(body);
    writeJson(target.file, document);
    send(response, 200, document);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Habit data folder: ${dataDir}`);
  console.log(`Data server listening on http://127.0.0.1:${port}`);
});
