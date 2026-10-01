import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ThemeMode } from '../models/settings.model';
import { StorageService } from './storage.service';

const BAR_COLORS = { dark: '#0f1115', light: '#f4f6fa' } as const;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = window.matchMedia?.('(prefers-color-scheme: light)');
  private mode: ThemeMode = 'dark';

  constructor() {
    inject(StorageService).settings$.subscribe((settings) => {
      this.mode = settings.theme;
      this.apply();
    });
    this.media?.addEventListener('change', () => this.apply());
  }

  private apply(): void {
    const resolved = this.mode === 'system' ? (this.media?.matches ? 'light' : 'dark') : this.mode;
    const root = this.document.documentElement;
    root.dataset['theme'] = resolved;
    root.style.colorScheme = resolved;
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[resolved]);
  }
}
