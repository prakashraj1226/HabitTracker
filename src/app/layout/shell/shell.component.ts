import { Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="shell">
      <app-sidebar [open]="navOpen()" [locked]="mobile() && !navOpen()" (navigated)="navOpen.set(false)" />
      @if (navOpen() && mobile()) {
        <button type="button" class="backdrop" aria-label="Close menu" (click)="navOpen.set(false)"></button>
      }
      <div class="main">
        <app-header (menu)="navOpen.set(true)" />
        <main id="main" class="content">
          <div class="content__inner">
            @if (fileError(); as message) {
              <div class="banner banner--error" role="alert">{{ message }}</div>
            }
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly navOpen = signal(false);
  readonly mobile = signal(false);
  readonly fileError = toSignal(inject(StorageService).error$, { initialValue: null });

  constructor() {
    const query = window.matchMedia('(max-width: 960px)');
    const update = () => {
      this.mobile.set(query.matches);
      if (!query.matches) {
        this.navOpen.set(false);
      }
    };
    update();
    query.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', update));
  }
}
