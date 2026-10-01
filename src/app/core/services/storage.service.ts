import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { AppMeta, AppSettings } from '../models/settings.model';

const PHONE_FILE = 'tracker.json';

interface TrackerDocument {
  habits: unknown[];
  completions: unknown[];
  entries: unknown[];
  settings: AppSettings;
  meta: AppMeta;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private document = emptyDocument();
  private saving: Promise<void> = Promise.resolve();
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly settingsSubject: BehaviorSubject<AppSettings>;

  readonly error$ = this.errorSubject.asObservable();
  readonly settings$: Observable<AppSettings>;

  constructor() {
    this.settingsSubject = new BehaviorSubject(this.readSettings());
    this.settings$ = this.settingsSubject.asObservable();
  }

  async load(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      return this.loadFromPhone();
    }
    try {
      const response = await fetch('/api/tracker', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('The data file could not be loaded.');
      }
      this.document = normalizeDocument(await response.json());
      if (this.importBrowserCopy()) {
        await this.flush();
      }
      this.errorSubject.next(null);
      this.settingsSubject.next(this.readSettings());
      return true;
    } catch (error) {
      this.errorSubject.next(error instanceof Error ? error.message : 'The data file could not be loaded.');
      this.settingsSubject.next(this.readSettings());
      return false;
    }
  }

  get<T>(key: string): T | null {
    const value = this.readKey(key);
    if (value === undefined) {
      return null;
    }
    return structuredClone(value) as T;
  }

  set<T>(key: string, value: T): void {
    this.writeKey(key, structuredClone(value));
    if (key === STORAGE_KEYS.settings) {
      this.settingsSubject.next(this.readSettings());
    }
    this.enqueueSave();
  }

  remove(key: string): void {
    this.writeKey(key, emptyValue(key));
    if (key === STORAGE_KEYS.settings) {
      this.settingsSubject.next(this.readSettings());
    }
    this.enqueueSave();
  }

  saveSettings(settings: AppSettings): void {
    this.set(STORAGE_KEYS.settings, { displayName: settings.displayName.trim() });
  }

  private readSettings(): AppSettings {
    return { displayName: this.document.settings.displayName.trim() };
  }

  private readKey(key: string): unknown {
    if (key === STORAGE_KEYS.habits) {
      return this.document.habits;
    }
    if (key === STORAGE_KEYS.completions) {
      return this.document.completions;
    }
    if (key === STORAGE_KEYS.settings) {
      return this.document.settings;
    }
    if (key === STORAGE_KEYS.meta) {
      return this.document.meta;
    }
    if (key === STORAGE_KEYS.entries) {
      return this.document.entries;
    }
    return undefined;
  }

  private writeKey(key: string, value: unknown): void {
    if (key === STORAGE_KEYS.habits && Array.isArray(value)) {
      this.document.habits = value;
      return;
    }
    if (key === STORAGE_KEYS.completions && Array.isArray(value)) {
      this.document.completions = value;
      return;
    }
    if (key === STORAGE_KEYS.settings && isSettings(value)) {
      this.document.settings = { displayName: value.displayName.slice(0, 40) };
      return;
    }
    if (key === STORAGE_KEYS.meta && isMeta(value)) {
      this.document.meta = { seeded: value.seeded };
      return;
    }
    if (key === STORAGE_KEYS.entries && Array.isArray(value)) {
      this.document.entries = value;
    }
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
      const settings = readBrowserJson(STORAGE_KEYS.settings);
      const hasHabits = Array.isArray(habits) && habits.length > 0;
      const hasCompletions = Array.isArray(completions) && completions.length > 0;
      const displayName = isSettings(settings) ? settings.displayName.trim() : '';
      if (!hasHabits && !hasCompletions && displayName === '') {
        return false;
      }
      this.document = {
        habits: hasHabits ? habits : [],
        completions: hasCompletions ? completions : [],
        entries: this.document.entries,
        settings: { displayName: displayName.slice(0, 40) },
        meta: { seeded: true },
      };
      return true;
    } catch {
      return false;
    }
  }

  private enqueueSave(): void {
    this.saving = this.saving.catch(() => undefined).then(() => this.flush());
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
        this.settingsSubject.next(this.readSettings());
        return false;
      }
      this.document = emptyDocument();
    }
    this.errorSubject.next(null);
    this.settingsSubject.next(this.readSettings());
    return true;
  }

  private async flush(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: PHONE_FILE,
          data: `${JSON.stringify(this.document, null, 2)}\n`,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch {
        this.errorSubject.next('Changes could not be saved on this phone.');
        throw new Error('Changes could not be saved on this phone.');
      }
      this.errorSubject.next(null);
      return;
    }
    const response = await fetch('/api/tracker', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.document),
      cache: 'no-store',
    });
    if (!response.ok) {
      this.errorSubject.next('Changes could not be saved to data/tracker.json.');
      throw new Error('Changes could not be saved to data/tracker.json.');
    }
    this.errorSubject.next(null);
  }
}

function emptyDocument(): TrackerDocument {
  return {
    habits: [],
    completions: [],
    entries: [],
    settings: { displayName: '' },
    meta: { seeded: false },
  };
}

function emptyValue(key: string): unknown {
  if (key === STORAGE_KEYS.habits || key === STORAGE_KEYS.completions || key === STORAGE_KEYS.entries) {
    return [];
  }
  if (key === STORAGE_KEYS.settings) {
    return { displayName: '' };
  }
  return { seeded: false };
}

function normalizeDocument(value: unknown): TrackerDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved data could not be read from data/tracker.json.');
  }
  const record = value as Partial<TrackerDocument>;
  return {
    habits: Array.isArray(record.habits) ? record.habits : [],
    completions: Array.isArray(record.completions) ? record.completions : [],
    settings: {
      displayName: isSettings(record.settings) ? record.settings.displayName.slice(0, 40) : '',
    },
    entries: Array.isArray(record.entries) ? record.entries : [],
    meta: { seeded: isMeta(record.meta) ? record.meta.seeded : false },
  };
}

function readBrowserJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  return JSON.parse(raw) as unknown;
}

function isSettings(value: unknown): value is AppSettings {
  return !!value && typeof value === 'object' && typeof (value as AppSettings).displayName === 'string';
}

function isMeta(value: unknown): value is AppMeta {
  return !!value && typeof value === 'object' && typeof (value as AppMeta).seeded === 'boolean';
}

function isMissingFile(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /does not exist|not found|no such file/i.test(message);
}
