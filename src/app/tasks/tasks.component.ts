import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../common/icon/icon.component';
import { EntryService } from '../core/services/entry.service';
import { addDays, toDateKey } from '../core/utils/date.util';
import { todayLabel } from '../core/utils/habit-view.util';
import { EntrySheetComponent } from '../plan/entry-sheet.component';

@Component({
  selector: 'app-tasks',
  imports: [RouterLink, IconComponent, EntrySheetComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">{{ heading }}</h1>
        <a class="ht-icon-btn ht-mobile-only" routerLink="/settings" aria-label="Settings"><app-icon name="gear" /></a>
      </header>
      <nav class="ht-seg" aria-label="Plan or tasks">
        <a routerLink="/plan">Plan</a>
        <a routerLink="/tasks" class="is-on" aria-current="page">Tasks</a>
      </nav>
      <div class="ht-views">
        <button type="button" [class.is-on]="!listMode()" (click)="listMode.set(false)">Timeline</button>
        <button type="button" [class.is-on]="listMode()" (click)="listMode.set(true)">All Tasks</button>
      </div>

      @if (!listMode()) {
        <div class="ht-stack">
          @for (day of days(); track day.key) {
            <div class="ht-row">
              <div>
                <strong [style.color]="day.key === todayKey ? '#3ddc97' : null">{{ day.label }}</strong>
                @if (day.key === todayKey) {
                  <p class="ht-muted">Tap to plan your day</p>
                }
                @for (entry of day.items; track entry.id) {
                  <button type="button" class="ht-chip" [style.text-decoration]="entry.done ? 'line-through' : 'none'" (click)="entries.toggle(entry.id)">
                    {{ entry.title }}
                  </button>
                }
              </div>
              <button type="button" class="ht-icon-btn" [attr.aria-label]="'Add for ' + day.label" (click)="openDay(day.date)">
                <app-icon name="plus" />
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="ht-stack">
          @for (entry of allTasks(); track entry.id) {
            <button type="button" class="ht-panel" (click)="entries.toggle(entry.id)">
              <strong [style.text-decoration]="entry.done ? 'line-through' : 'none'">{{ entry.title }}</strong>
              <small class="ht-muted">{{ entry.date }} · {{ entry.time }}</small>
            </button>
          } @empty {
            <p class="ht-empty">No tasks yet.</p>
          }
        </div>
      }
    </section>

    @if (open()) {
      <app-entry-sheet [date]="selected()" (closed)="close()" (saved)="save($event)" />
    }
  `,
})
export class TasksComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly entries = inject(EntryService);
  private readonly list = toSignal(this.entries.entries$, { initialValue: this.entries.getAll() });

  readonly heading = todayLabel();
  readonly today = new Date();
  readonly todayKey = toDateKey(this.today);
  readonly listMode = signal(false);
  readonly selected = signal(this.today);
  readonly open = signal(this.route.snapshot.queryParamMap.get('compose') === '1');

  readonly days = computed(() => Array.from({ length: 16 }, (_, index) => addDays(this.today, 4 - index)).map((date) => {
    const key = toDateKey(date);
    return {
      date,
      key,
      label: date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', weekday: 'short' }),
      items: (this.list() ?? []).filter((entry) => entry.date === key && entry.inList),
    };
  }));

  readonly allTasks = computed(() => (this.list() ?? []).filter((entry) => entry.inList));

  openDay(date: Date): void {
    this.selected.set(date);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  save(draft: { title: string; time: string; type: 'task' | 'note'; inList: boolean }): void {
    this.entries.create({ ...draft, date: toDateKey(this.selected()), inList: true, type: 'task' });
    this.close();
  }
}
