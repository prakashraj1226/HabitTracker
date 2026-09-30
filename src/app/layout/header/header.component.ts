import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon/icon.component';
import { StorageService } from '../../core/services/storage.service';
import { formatLongDate } from '../../core/utils/date.util';

@Component({
  selector: 'app-header',
  imports: [IconComponent, RouterLink],
  template: `
    <header class="topbar">
      <div class="topbar__start">
        <button type="button" class="btn btn--secondary btn--sm menu-btn" (click)="menu.emit()" aria-label="Open menu">
          <app-icon name="menu" />
        </button>
        <div>
          <p class="topbar__greeting">{{ greeting() }}</p>
          <p class="topbar__date">{{ todayLabel }}</p>
        </div>
      </div>
      <a class="btn btn--primary btn--sm" routerLink="/habits/new">
        <app-icon name="plus" />
        Add habit
      </a>
    </header>
  `,
})
export class HeaderComponent {
  readonly menu = output<void>();
  readonly todayLabel = formatLongDate(new Date());
  private readonly settings = toSignal(inject(StorageService).settings$, { initialValue: { displayName: '' } });
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = this.settings().displayName.trim();
    return name ? `${part}, ${name}` : part;
  });
}
