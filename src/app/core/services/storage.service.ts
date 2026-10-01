import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { AppMeta, AppSettings, ThemeMode } from '../models/settings.model';
import { FileStoreService } from './file-store.service';

const THEMES: ThemeMode[] = ['dark', 'light', 'system'];

const LIST_KEYS = {
  [STORAGE_KEYS.habits]: 'habits',
  [STORAGE_KEYS.completions]: 'completions',
  [STORAGE_KEYS.entries]: 'entries',
  [STORAGE_KEYS.goals]: 'goals',
  [STORAGE_KEYS.achievements]: 'achievements',
} as const;

type ListName = (typeof LIST_KEYS)[keyof typeof LIST_KEYS];

export type TrackerDocument = Record<ListName, unknown[]> & {
  settings: AppSettings;
  meta: AppMeta;
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly files = inject(FileStoreService);
  private document = emptyDocument();
  private userId: string | null = null;
  private saving: Promise<void> = Promise.resolve();
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly settingsSubject = new BehaviorSubject<AppSettings>(this.readSettings());

  readonly error$ = this.errorSubject.asObservable();
  readonly settings$: Observable<AppSettings> = this.settingsSubject.asObservable();

  async open(userId: string): Promise<void> {
    await this.close();
    const value = await this.files.read({ kind: 'user', id: userId });
    this.document = value === null ? emptyDocument() : normalizeDocument(value);
    this.userId = userId;
    this.errorSubject.next(null);
    this.settingsSubject.next(this.readSettings());
  }

  async create(userId: string, document: TrackerDocument | null, displayName: string): Promise<void> {
    const initial = document ?? emptyDocument();
    initial.settings = normalizeSettings({ ...initial.settings, displayName: initial.settings.displayName || displayName });
    initial.meta = { seeded: true };
    await this.files.write({ kind: 'user', id: userId }, initial);
  }

  async close(): Promise<void> {
    await this.saving.catch(() => undefined);
    this.userId = null;
    this.document = emptyDocument();
    this.settingsSubject.next(this.readSettings());
  }

  async readLegacy(): Promise<TrackerDocument | null> {
    try {
      const value = await this.files.read({ kind: 'legacy' });
      if (value === null) {
        return null;
      }
      const document = normalizeDocument(value);
      return document.habits.length || document.completions.length || document.entries.length ? document : null;
    } catch {
      return null;
    }
  }

  async removeUser(userId: string): Promise<void> {
    await this.files.remove({ kind: 'user', id: userId });
  }

  get<T>(key: string): T | null {
    const value = this.readKey(key);
    return value === undefined ? null : (structuredClone(value) as T);
  }

  set<T>(key: string, value: T): void {
    this.writeKey(key, structuredClone(value));
    if (key === STORAGE_KEYS.settings) {
      this.settingsSubject.next(this.readSettings());
    }
    this.enqueueSave();
  }

  saveSettings(settings: Partial<AppSettings>): void {
    this.set(STORAGE_KEYS.settings, { ...this.readSettings(), ...settings });
  }

  reportError(message: string | null): void {
    this.errorSubject.next(message);
  }

  dismissError(): void {
    this.errorSubject.next(null);
  }

  private readSettings(): AppSettings {
    return { ...this.document.settings };
  }

  private readKey(key: string): unknown {
    if (key in LIST_KEYS) {
      return this.document[LIST_KEYS[key as keyof typeof LIST_KEYS]];
    }
    if (key === STORAGE_KEYS.settings) {
      return this.document.settings;
    }
    if (key === STORAGE_KEYS.meta) {
      return this.document.meta;
    }
    return undefined;
  }

  private writeKey(key: string, value: unknown): void {
    if (key in LIST_KEYS && Array.isArray(value)) {
      this.document[LIST_KEYS[key as keyof typeof LIST_KEYS]] = value;
    } else if (key === STORAGE_KEYS.settings) {
      this.document.settings = normalizeSettings(value);
    } else if (key === STORAGE_KEYS.meta && isMeta(value)) {
      this.document.meta = { seeded: value.seeded };
    }
  }

  private enqueueSave(): void {
    const userId = this.userId;
    if (!userId) {
      return;
    }
    const snapshot = structuredClone(this.document);
    this.saving = this.saving
      .catch(() => undefined)
      .then(() => this.files.write({ kind: 'user', id: userId }, snapshot))
      .then(() => this.errorSubject.next(null))
      .catch((error: unknown) => {
        this.errorSubject.next(error instanceof Error ? error.message : 'Changes could not be saved.');
      });
  }
}

function emptyDocument(): TrackerDocument {
  return {
    habits: [],
    completions: [],
    entries: [],
    goals: [],
    achievements: [],
    settings: { displayName: '', theme: 'dark' },
    meta: { seeded: true },
  };
}

function normalizeDocument(value: unknown): TrackerDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved data could not be read.');
  }
  const record = value as Record<string, unknown>;
  const document = emptyDocument();
  for (const name of Object.values(LIST_KEYS)) {
    const list = record[name];
    document[name] = Array.isArray(list) ? list : [];
  }
  document.settings = normalizeSettings(record['settings']);
  return document;
}

function normalizeSettings(value: unknown): AppSettings {
  const record = value && typeof value === 'object' ? (value as Partial<AppSettings>) : {};
  return {
    displayName: typeof record.displayName === 'string' ? record.displayName.trim().slice(0, 40) : '',
    theme: THEMES.includes(record.theme as ThemeMode) ? (record.theme as ThemeMode) : 'dark',
  };
}

function isMeta(value: unknown): value is AppMeta {
  return !!value && typeof value === 'object' && typeof (value as AppMeta).seeded === 'boolean';
}
