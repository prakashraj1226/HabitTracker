import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

// Must match the hashing in src/app/core/services/auth.service.ts.
const ITERATIONS = 150_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.TRACKER_DIR ? path.resolve(process.env.TRACKER_DIR) : path.join(root, 'data');
const accountsFile = path.join(dataDir, 'accounts.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hashSecret(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, 32, 'sha256').toString('hex');
}

function makeRecoveryCode() {
  const chars = Array.from(crypto.randomBytes(12), (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (text) => {
      rl.output.write(rl.stdoutMuted ? text.replace(/[^\r\n]/g, '') : text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

const username = (process.argv[2] ?? '').trim().toLowerCase();
if (!fs.existsSync(accountsFile)) {
  fail(`No accounts found in ${dataDir}.`);
}
const file = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
const accounts = Array.isArray(file.accounts) ? file.accounts : [];
if (!username) {
  fail(`Usage: npm run reset-password -- <username>\nAccounts on this computer: ${accounts.map((item) => item.username).join(', ') || 'none'}`);
}
const account = accounts.find((item) => item.username === username);
if (!account) {
  fail(`No account called "${username}". Accounts on this computer: ${accounts.map((item) => item.username).join(', ') || 'none'}`);
}

const password = await askHidden(`New password for ${account.name} (@${account.username}): `);
if (password.length < 6 || password.length > 64) {
  fail('Password must be 6–64 characters.');
}
const confirm = await askHidden('Type it again: ');
if (password !== confirm) {
  fail('The two passwords do not match.');
}

const recoveryCode = makeRecoveryCode();
account.salt = crypto.randomBytes(16).toString('hex');
account.passwordHash = hashSecret(password, account.salt);
account.recoverySalt = crypto.randomBytes(16).toString('hex');
account.recoveryHash = hashSecret(recoveryCode.replace(/-/g, ''), account.recoverySalt);

const temporary = `${accountsFile}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`);
fs.renameSync(temporary, accountsFile);

console.log(`\nPassword changed for @${account.username}.`);
console.log(`New recovery code: ${recoveryCode}`);
console.log('Save this code. The old one no longer works.');
