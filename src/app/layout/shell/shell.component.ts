import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { combineLatest, filter, map } from 'rxjs';
import { IconComponent } from '../../common/icon/icon.component';
import { AchievementService } from '../../core/services/achievement.service';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { HabitService } from '../../core/services/habit.service';
import { StorageService } from '../../core/services/storage.service';
import { AuthService } from '../../core/services/auth.service';
import { AchievementDef } from '../../core/utils/stats.util';

type Tab = 'today' | 'habits' | 'calendar' | 'stats' | 'plan' | 'tasks' | 'settings';

const NAV: { tab: Tab; link: string; icon: string; label: string; pill: boolean }[] = [
  { tab: 'today', link: '/today', icon: 'home', label: 'Today', pill: true },
  { tab: 'habits', link: '/habits', icon: 'check', label: 'Habits', pill: true },
  { tab: 'calendar', link: '/calendar', icon: 'calendar', label: 'Calendar', pill: true },
  { tab: 'stats', link: '/stats', icon: 'stats', label: 'Stats', pill: true },
  { tab: 'plan', link: '/plan', icon: 'plan', label: 'Plan', pill: true },
  { tab: 'tasks', link: '/tasks', icon: 'tasks', label: 'Tasks', pill: false },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, IconComponent],
  template: `
    <div class="ht">
      <aside class="ht-side" aria-label="Main">
        <div class="ht-brand"><span><app-icon name="check" /></span> Habit Tick</div>
        <nav>
          @for (item of nav; track item.tab) {
            <a [routerLink]="item.link" [class.is-on]="tab() === item.tab" [attr.aria-current]="tab() === item.tab ? 'page' : null">
              <app-icon [name]="item.icon" /> {{ item.label }}
            </a>
          }
          <a class="ht-side__add" routerLink="/habits/new"><app-icon name="plus" /> New habit</a>
        </nav>
        <nav class="ht-side__foot">
          @if (account(); as user) {
            <div class="ht-account">
              <b>{{ user.name.charAt(0).toUpperCase() }}</b>
              <span>{{ user.name }}<br /><small class="ht-muted">&#64;{{ user.username }}</small></span>
            </div>
          }
          <a routerLink="/settings" [class.is-on]="tab() === 'settings'"><app-icon name="gear" /> Settings</a>
          <a href="" (click)="logout($event)"><app-icon name="chevronLeft" /> Log out</a>
        </nav>
      </aside>

      <div class="ht-main">
        @if (error(); as message) {
          <div class="ht-banner" role="alert">
            <app-icon name="alert" />
            <span>{{ message }}</span>
            <button type="button" (click)="dismissError()" aria-label="Dismiss"><app-icon name="close" /></button>
          </div>
        }
        <router-outlet />
      </div>

      @if (showTabs()) {
        <nav class="ht-tabs" aria-label="Primary">
          <div class="ht-pill">
            @for (item of pillNav; track item.tab) {
              <a [routerLink]="item.link" [class.is-on]="pillTab() === item.tab" [attr.aria-label]="item.label"
                 [attr.aria-current]="pillTab() === item.tab ? 'page' : null">
                <app-icon [name]="item.icon" />
                @if (pillTab() === item.tab) { <span>{{ item.label }}</span> }
              </a>
            }
          </div>
          @if (tab() === 'plan') {
            <a class="ht-fab" routerLink="/plan" [queryParams]="{ compose: '1' }" aria-label="Plan a slot"><app-icon name="clock" /></a>
          } @else if (tab() === 'tasks') {
            <a class="ht-fab" routerLink="/tasks" [queryParams]="{ compose: '1' }" aria-label="Add a task"><app-icon name="check" /></a>
          } @else {
            <a class="ht-fab" routerLink="/habits/new" aria-label="Add habit"><app-icon name="plus" /></a>
          }
        </nav>
      }

      @if (toast(); as achievement) {
        <div class="ht-toast" role="status" (click)="toast.set(null)">
          <b>{{ achievement.icon }}</b>
          <div>
            <small>ACHIEVEMENT UNLOCKED</small>
            <strong>{{ achievement.title }}</strong>
            <div class="ht-muted ht-small">{{ achievement.description }}</div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  readonly account = this.auth.current;
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly nav = NAV;
  readonly pillNav = NAV.filter((item) => item.pill);
  readonly toast = signal<AchievementDef | null>(null);
  readonly error = toSignal(
    combineLatest([this.storage.error$, inject(HabitService).error$, inject(HabitCompletionService).error$])
      .pipe(map((errors) => errors.find((message) => !!message) ?? null)),
    { initialValue: null },
  );

  readonly showTabs = computed(() => !/^\/(habits\/(new|\d+)|settings)/.test(this.path()));
  readonly tab = computed<Tab>(() => {
    const path = this.path();
    return NAV.find((item) => path.startsWith(item.link))?.tab ?? (path.startsWith('/settings') ? 'settings' : 'today');
  });
  readonly pillTab = computed<Tab>(() => (this.tab() === 'tasks' ? 'plan' : this.tab()));

  private toastTimer = 0;

  constructor() {
    inject(AchievementService).newlyUnlocked$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((achievement) => {
        this.toast.set(achievement);
        window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.toast.set(null), 4500);
      });
  }

  dismissError(): void {
    this.storage.dismissError();
  }

  logout(event: Event): void {
    event.preventDefault();
    void this.auth.logout();
  }

  private path(): string {
    return (this.url() ?? '/today').split('?')[0];
  }
}
