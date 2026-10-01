import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { AppMeta, AppSettings, ThemeMode } from '../models/settings.model';

const PHONE_FILE = 'tracker.json';
const THEMES: ThemeMode[] = ['dark', 'light', 'system'];

const LIST_KEYS = {
  [STORAGE_KEYS.habits]: 'habits',
  [STORAGE_KEYS.completions]: 'completions',
  [STORAGE_KEYS.entries]: 'entries',
  [STORAGE_KEYS.goals]: 'goals',
  [STORAGE_KEYS.achievements]: 'achievements',
} as const;

type ListName = (typeof LIST_KEYS)[keyof typeof LIST_KEYS];

type TrackerDocument = Record<ListName, unknown[]> & {
  settings: AppSettings;
  meta: AppMeta;
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  private document = emptyDocument();
  private saving: Promise<void> = Promise.resolve();
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  private readonly settingsSubject: BehaviorSubject<AppSettings>;

  readonly error$ = this.errorSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly settings$: Observable<AppSettings>;

  constructor() {
    this.settingsSubject = new BehaviorSubject(this.readSettings());
    this.settings$ = this.settingsSubject.asObservable();
  }

  async load(): Promise<boolean> {
    this.loadingSubject.next(true);
    try {
      return Capacitor.isNativePlatform() ? await this.loadFromPhone() : await this.loadFromServer();
    } finally {
      this.settingsSubject.next(this.readSettings());
      this.loadingSubject.next(false);
    }
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

  remove(key: string): void {
    if (key in LIST_KEYS) {
      this.writeKey(key, []);
    } else if (key === STORAGE_KEYS.settings) {
      this.writeKey(key, { displayName: '', theme: 'dark' });
      this.settingsSubject.next(this.readSettings());
    } else if (key === STORAGE_KEYS.meta) {
      this.writeKey(key, { seeded: false });
    }
    this.enqueueSave();
  }

  saveSettings(settings: Partial<AppSettings>): void {
    this.set(STORAGE_KEYS.settings, { ...this.readSettings(), ...settings });
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

  private async loadFromServer(): Promise<boolean> {
    try {
      const response = await fetch('/api/tracker', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('The data file could not be loaded. Is the data server running (npm start)?');
      }
      this.document = normalizeDocument(await response.json());
      if (this.importBrowserCopy()) {
        await this.flush();
      }
      this.errorSubject.next(null);
      return true;
    } catch (error) {
      this.errorSubject.next(
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : 'The data server is not reachable. Start the app with npm start.',
      );
      return false;
    }
  }

  private async loadFromPhone(): Promise<boolean> {
    try {
      const result = await Filesystem.readFile({
        path: PHONE_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const text = typeof result.data === 'string' ? result.data : await result.data.text();
      this.document = normalizeDocument(JSON.parse(text));
    } catch (error) {
      if (!isMissingFile(error)) {
        this.errorSubject.next('Saved habits on this phone could not be read.');
        return false;
      }
      this.document = emptyDocument();
    }
    this.errorSubject.next(null);
    return true;
  }

  private importBrowserCopy(): boolean {
    const fileIsEmpty = this.document.habits.length === 0
      && this.document.completions.length === 0
      && !this.document.meta.seeded
      && this.document.settings.displayName === '';
    if (!fileIsEmpty) {
      return false;
    }
    try {
      const habits = readBrowserJson(STORAGE_KEYS.habits);
      const completions = readBrowserJson(STORAGE_KEYS.completions);
      const hasHabits = Array.isArray(habits) && habits.length > 0;
      const hasCompletions = Array.isArray(completions) && completions.length > 0;
      if (!hasHabits && !hasCompletions) {
        return false;
      }
      this.document.habits = hasHabits ? habits : [];
      this.document.completions = hasCompletions ? completions : [];
      this.document.settings = normalizeSettings(readBrowserJson(STORAGE_KEYS.settings));
      this.document.meta = { seeded: true };
      return true;
    } catch {
      return false;
    }
  }

  private enqueueSave(): void {
    this.saving = this.saving.catch(() => undefined).then(() => this.flush());
  }

  private async flush(): Promise<void> {
    const body = `${JSON.stringify(this.document, null, 2)}\n`;
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: PHONE_FILE,
          data: body,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch {
        this.fail('Changes could not be saved on this phone.');
      }
      this.errorSubject.next(null);
      return;
    }
    let response: Response;
    try {
      response = await fetch('/api/tracker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      });
    } catch {
      this.fail('Changes were not saved: the data server is not reachable.');
    }
    if (!response.ok) {
      this.fail('Changes could not be saved to data/tracker.json.');
    }
    this.errorSubject.next(null);
  }

  private fail(message: string): never {
    this.errorSubject.next(message);
    throw new Error(message);
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
    meta: { seeded: false },
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
  document.meta = { seeded: isMeta(record['meta']) ? record['meta'].seeded : false };
  return document;
}

function normalizeSettings(value: unknown): AppSettings {
  const record = value && typeof value === 'object' ? (value as Partial<AppSettings>) : {};
  return {
    displayName: typeof record.displayName === 'string' ? record.displayName.trim().slice(0, 40) : '',
    theme: THEMES.includes(record.theme as ThemeMode) ? (record.theme as ThemeMode) : 'dark',
  };
}

function readBrowserJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

function isMeta(value: unknown): value is AppMeta {
  return !!value && typeof value === 'object' && typeof (value as AppMeta).seeded === 'boolean';
}

function isMissingFile(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /does not exist|not found|no such file/i.test(message);
}
