import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent } from '../../common/icon/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, IconComponent],
  template: `
    <div class="ht">
      <div class="ht-frame">
        <router-outlet />
        @if (showTabs()) {
          <nav class="ht-tabs" aria-label="Primary">
            <div class="ht-pill">
              <a routerLink="/habits" [class.is-on]="tab() === 'habits'" [attr.aria-current]="tab() === 'habits' ? 'page' : null">
                <app-icon name="check" />
                @if (tab() === 'habits') { <span>Habits</span> }
              </a>
              <a routerLink="/plan" [class.is-on]="tab() === 'plan'" [attr.aria-current]="tab() === 'plan' ? 'page' : null">
                <app-icon name="plan" />
                @if (tab() === 'plan') { <span>Plan</span> }
              </a>
              <a routerLink="/tasks" [class.is-on]="tab() === 'tasks'" [attr.aria-current]="tab() === 'tasks' ? 'page' : null">
                <app-icon name="tasks" />
                @if (tab() === 'tasks') { <span>Tasks</span> }
              </a>
            </div>
            @if (tab() === 'plan') {
              <a class="ht-fab" routerLink="/plan" [queryParams]="{ compose: '1' }" aria-label="Plan a slot">
                <app-icon name="clock" />
              </a>
            } @else if (tab() === 'tasks') {
              <a class="ht-fab" routerLink="/tasks" [queryParams]="{ compose: '1' }" aria-label="Add a task">
                <app-icon name="check" />
              </a>
            } @else {
              <a class="ht-fab" routerLink="/habits/new" aria-label="Add habit">
                <app-icon name="plus" />
              </a>
            }
          </nav>
        }
      </div>
    </div>
  `,
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showTabs = computed(() => !/\/habits\/(new|\d+)|\/settings/.test(this.path()));
  readonly tab = computed(() => {
    const path = this.path();
    if (path.startsWith('/plan')) {
      return 'plan';
    }
    if (path.startsWith('/tasks')) {
      return 'tasks';
    }
    return 'habits';
  });

  private path(): string {
    return (this.url() ?? '/habits').split('?')[0];
  }
}
