import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../common/icon/icon.component';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  host: {
    class: 'sidebar',
    '[class.sidebar--open]': 'open()',
    '[attr.inert]': 'locked() ? "" : null',
    '[attr.aria-hidden]': 'locked() ? "true" : null',
  },
  template: `
    <a class="brand" routerLink="/dashboard" (click)="navigated.emit()">
      <span class="brand__mark">HT</span>
      <span>
        <span class="brand__name">Habit Tracker</span>
        <span class="brand__tag">Personal progress</span>
      </span>
    </a>
    <nav class="nav" aria-label="Primary">
      @for (item of items; track item.path) {
        <a
          class="nav__link"
          [routerLink]="item.path"
          routerLinkActive="nav__link--active"
          [routerLinkActiveOptions]="{ exact: item.exact }"
          ariaCurrentWhenActive="page"
          (click)="navigated.emit()">
          <app-icon [name]="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
    <p class="sidebar__footer">Saved in data/tracker.json</p>
  `,
})
export class SidebarComponent {
  readonly open = input(false);
  readonly locked = input(false);
  readonly navigated = output<void>();
  readonly items = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/habits/new', label: 'Add habit', icon: 'plus', exact: true },
    { path: '/habits', label: 'Manage habits', icon: 'habits', exact: true },
    { path: '/calendar', label: 'Calendar', icon: 'calendar', exact: false },
    { path: '/settings', label: 'Settings', icon: 'settings', exact: true },
  ];
}
