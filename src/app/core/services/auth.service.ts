import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Account, AccountsFile, PublicAccount } from '../models/account.model';
import { AchievementService } from './achievement.service';
import { EntryService } from './entry.service';
import { FileStoreService } from './file-store.service';
import { GoalService } from './goal.service';
import { HabitCompletionService } from './habit-completion.service';
import { HabitService } from './habit.service';
import { ReminderService } from './reminder.service';
import { StorageService } from './storage.service';

const SESSION_KEY = 'habit-tracker.session';
const LAST_USER_KEY = 'habit-tracker.last-user';
const LOCK_AFTER_MS = 15 * 60 * 1000;
const ITERATIONS = 150_000;
const USERNAME = /^[a-z0-9_.]{3,20}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Session {
  userId: string;
  lastSeen: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly files = inject(FileStoreService);
  private readonly storage = inject(StorageService);
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly entries = inject(EntryService);
  private readonly goals = inject(GoalService);
  private readonly achievements = inject(AchievementService);
  private readonly reminders = inject(ReminderService);
  private readonly router = inject(Router);

  private readonly accounts = signal<Account[]>([]);
  private legacyClaimed = false;

  readonly current = signal<PublicAccount | null>(null);
  readonly hasAccounts = computed(() => this.accounts().length > 0);
  readonly native = Capacitor.isNativePlatform();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.touch();
      } else {
        this.checkIdle();
      }
    });
    window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.touch();
      }
    }, 30_000);
  }

  async init(): Promise<void> {
    try {
      const value = await this.files.read({ kind: 'accounts' });
      const file = normalizeAccounts(value);
      this.accounts.set(file.accounts);
      this.legacyClaimed = file.legacyClaimed;
    } catch (error) {
      this.storage.reportError(error instanceof Error ? error.message : 'Accounts could not be loaded.');
      return;
    }
    const session = readSession();
    const account = session && this.accounts().find((item) => item.id === session.userId);
    if (account && session && Date.now() - session.lastSeen < LOCK_AFTER_MS) {
      try {
        await this.openSession(account);
      } catch (error) {
        this.storage.reportError(error instanceof Error ? error.message : 'Your habits could not be loaded.');
      }
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  lastUsername(): string {
    return localStorage.getItem(LAST_USER_KEY) ?? '';
  }

  accountFor(username: string): PublicAccount | null {
    const account = this.find(username);
    return account ? toPublic(account) : null;
  }

  async register(name: string, username: string, password: string): Promise<string> {
    const cleanName = name.trim();
    const cleanUser = username.trim().toLowerCase();
    if (cleanName.length < 1 || cleanName.length > 40) {
      throw new Error('Enter your name (up to 40 characters).');
    }
    if (!USERNAME.test(cleanUser)) {
      throw new Error('Username must be 3–20 characters: letters, numbers, dot or underscore.');
    }
    checkPassword(password);
    if (this.find(cleanUser)) {
      throw new Error('That username is already taken on this device.');
    }
    const recoveryCode = makeRecoveryCode();
    const salt = randomHex(16);
    const recoverySalt = randomHex(16);
    const account: Account = {
      id: randomHex(8),
      name: cleanName,
      username: cleanUser,
      salt,
      passwordHash: await hashSecret(password, salt),
      recoverySalt,
      recoveryHash: await hashSecret(normalizeCode(recoveryCode), recoverySalt),
      biometric: false,
      createdAt: new Date().toISOString(),
    };
    const legacy = !this.legacyClaimed && !this.accounts().length ? await this.storage.readLegacy() : null;
    await this.storage.create(account.id, legacy, cleanName);
    await this.saveAccounts([...this.accounts(), account], true);
    await this.openSession(account);
    return recoveryCode;
  }

  async login(username: string, password: string): Promise<void> {
    const account = this.find(username);
    if (!account || (await hashSecret(password, account.salt)) !== account.passwordHash) {
      throw new Error('Wrong username or password.');
    }
    await this.openSession(account);
  }

  async biometricAvailable(): Promise<boolean> {
    if (!this.native) {
      return false;
    }
    try {
      return (await NativeBiometric.isAvailable()).isAvailable;
    } catch {
      return false;
    }
  }

  async loginWithBiometric(username: string): Promise<void> {
    const account = this.find(username);
    if (!account?.biometric) {
      throw new Error('Fingerprint unlock is not turned on for this account.');
    }
    await this.verifyBiometric(`Unlock ${account.name}'s habits`);
    await this.openSession(account);
  }

  async resetPassword(username: string, code: string, password: string): Promise<string> {
    const account = this.find(username);
    if (!account || (await hashSecret(normalizeCode(code), account.recoverySalt)) !== account.recoveryHash) {
      throw new Error('That username and recovery code do not match.');
    }
    checkPassword(password);
    const recoveryCode = makeRecoveryCode();
    const salt = randomHex(16);
    const recoverySalt = randomHex(16);
    await this.updateAccount(account.id, {
      salt,
      passwordHash: await hashSecret(password, salt),
      recoverySalt,
      recoveryHash: await hashSecret(normalizeCode(recoveryCode), recoverySalt),
    });
    return recoveryCode;
  }

  async changePassword(currentPassword: string, password: string): Promise<void> {
    const account = await this.verifyCurrent(currentPassword);
    checkPassword(password);
    const salt = randomHex(16);
    await this.updateAccount(account.id, { salt, passwordHash: await hashSecret(password, salt) });
  }

  async newRecoveryCode(currentPassword: string): Promise<string> {
    const account = await this.verifyCurrent(currentPassword);
    const recoveryCode = makeRecoveryCode();
    const recoverySalt = randomHex(16);
    await this.updateAccount(account.id, { recoverySalt, recoveryHash: await hashSecret(normalizeCode(recoveryCode), recoverySalt) });
    return recoveryCode;
  }

  async rename(name: string): Promise<void> {
    const account = this.require();
    const cleanName = name.trim();
    if (cleanName.length < 1 || cleanName.length > 40) {
      throw new Error('Enter your name (up to 40 characters).');
    }
    await this.updateAccount(account.id, { name: cleanName });
  }

  async setBiometric(on: boolean): Promise<void> {
    const account = this.require();
    if (on) {
      if (!(await this.biometricAvailable())) {
        throw new Error('No fingerprint or face unlock is set up on this phone.');
      }
      await this.verifyBiometric('Confirm to turn on fingerprint unlock');
    }
    await this.updateAccount(account.id, { biometric: on });
  }

  async deleteAccount(password: string): Promise<void> {
    const account = await this.verifyCurrent(password);
    await this.closeSession();
    await this.storage.removeUser(account.id);
    await this.saveAccounts(this.accounts().filter((item) => item.id !== account.id), this.legacyClaimed);
    if (this.lastUsername() === account.username) {
      localStorage.removeItem(LAST_USER_KEY);
    }
    await this.router.navigateByUrl(this.hasAccounts() ? '/login' : '/register');
  }

  async logout(): Promise<void> {
    await this.closeSession();
    await this.router.navigateByUrl('/login');
  }

  private checkIdle(): void {
    const session = readSession();
    if (this.current() && (!session || Date.now() - session.lastSeen >= LOCK_AFTER_MS)) {
      void this.logout();
    } else {
      this.touch();
    }
  }

  private touch(): void {
    const account = this.current();
    if (account) {
      writeSession({ userId: account.id, lastSeen: Date.now() });
    }
  }

  private async openSession(account: Account): Promise<void> {
    await this.storage.open(account.id);
    this.reloadData();
    this.current.set(toPublic(account));
    localStorage.setItem(LAST_USER_KEY, account.username);
    this.touch();
    await this.reminders.refresh();
  }

  private async closeSession(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    this.current.set(null);
    await this.storage.close();
    this.reloadData();
    await this.reminders.refresh();
  }

  private reloadData(): void {
    this.achievements.reload();
    this.goals.reload();
    this.entries.reload();
    this.completions.reload();
    this.habits.reload();
  }

  private async verifyBiometric(reason: string): Promise<void> {
    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Habit Tick',
        subtitle: reason,
        negativeButtonText: 'Use password',
        maxAttempts: 5,
      });
    } catch {
      throw new Error('Fingerprint was not recognised. Use your password.');
    }
  }

  private async verifyCurrent(password: string): Promise<Account> {
    const account = this.require();
    if ((await hashSecret(password, account.salt)) !== account.passwordHash) {
      throw new Error('Your current password is wrong.');
    }
    return account;
  }

  private require(): Account {
    const id = this.current()?.id;
    const account = this.accounts().find((item) => item.id === id);
    if (!account) {
      throw new Error('Please log in again.');
    }
    return account;
  }

  private find(username: string): Account | undefined {
    const clean = username.trim().toLowerCase();
    return this.accounts().find((item) => item.username === clean);
  }

  private async updateAccount(id: string, change: Partial<Account>): Promise<void> {
    const next = this.accounts().map((item) => (item.id === id ? { ...item, ...change } : item));
    await this.saveAccounts(next, this.legacyClaimed);
    const updated = next.find((item) => item.id === id);
    if (updated && this.current()?.id === id) {
      this.current.set(toPublic(updated));
    }
  }

  private async saveAccounts(accounts: Account[], legacyClaimed: boolean): Promise<void> {
    const file: AccountsFile = { accounts, legacyClaimed };
    await this.files.write({ kind: 'accounts' }, file);
    this.accounts.set(accounts);
    this.legacyClaimed = legacyClaimed;
  }
}

function toPublic(account: Account): PublicAccount {
  return { id: account.id, name: account.name, username: account.username, biometric: account.biometric, createdAt: account.createdAt };
}

function normalizeAccounts(value: unknown): AccountsFile {
  const record = value && typeof value === 'object' ? (value as Partial<AccountsFile>) : {};
  const accounts = Array.isArray(record.accounts)
    ? record.accounts.filter((item) => typeof item?.id === 'string' && typeof item?.username === 'string' && typeof item?.passwordHash === 'string')
    : [];
  return { accounts, legacyClaimed: record.legacyClaimed === true };
}

function checkPassword(password: string): void {
  if (password.length < 6 || password.length > 64) {
    throw new Error('Password must be 6–64 characters.');
  }
}

function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    return value && typeof value.userId === 'string' && typeof value.lastSeen === 'number' ? value : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeRecoveryCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error('Open the app at http://localhost:4200 so passwords can be checked securely.');
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
