import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filePath = process.env.TRACKER_FILE
  ? path.resolve(process.env.TRACKER_FILE)
  : path.join(root, 'data', 'tracker.json');
const port = Number(process.env.TRACKER_PORT ?? 4300);
const maxBytes = 2 * 1024 * 1024;

const LISTS = ['habits', 'completions', 'entries', 'goals', 'achievements'];
const THEMES = ['dark', 'light', 'system'];

function emptyDocument() {
  return normalize({});
}

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

function readDocument() {
  try {
    return normalize(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const document = emptyDocument();
      writeDocument(document);
      return document;
    }
    throw error;
  }
}

function writeDocument(document) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = request.url?.split('?')[0];
  if (url !== '/api/tracker') {
    send(response, 404, { error: 'Not found.' });
    return;
  }
  if (request.method === 'GET') {
    try {
      send(response, 200, readDocument());
    } catch {
      send(response, 500, { error: 'Could not read the data file.' });
    }
    return;
  }
  if (request.method !== 'PUT') {
    send(response, 405, { error: 'Method not allowed.' });
    return;
  }

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
      const document = normalize(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      writeDocument(document);
      send(response, 200, document);
    } catch {
      send(response, 400, { error: 'The data file could not be updated.' });
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Habit data file: ${filePath}`);
  console.log(`Data server listening on http://127.0.0.1:${port}`);
});
