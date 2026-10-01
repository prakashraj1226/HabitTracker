export type ThemeMode = 'dark' | 'light' | 'system';

export interface AppSettings {
  displayName: string;
  theme: ThemeMode;
}

export interface AppMeta {
  seeded: boolean;
}
