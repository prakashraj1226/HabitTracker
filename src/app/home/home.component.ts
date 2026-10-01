import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ConfirmationDialogComponent } from '../common/confirmation-dialog/confirmation-dialog.component';
import { IconComponent } from '../common/icon/icon.component';
import { FREQUENCY_OPTIONS } from '../core/constants/habit.constants';
import { Habit, HabitFrequency } from '../core/models/habit.model';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { addDays, startOfWeek, toDateKey, weekDates } from '../core/utils/date.util';
import { frequencyLabel, habitColor, heatmapWeeks, shortDay, todayLabel } from '../core/utils/habit-view.util';
import {
  amountOn, dailyTarget, dayState, doneDaysBetween, habitStats, indexCompletions, isDoneOn, isFlexible,
  rangeTally, weeklyTarget,
} from '../core/utils/stats.util';

type HomeView = 'measure' | 'tick' | 'weekly';
type StatusFilter = 'active' | 'done' | 'todo' | 'missed' | 'archived';

@Component({
  selector: 'app-home',
  imports: [RouterLink, IconComponent, ConfirmationDialogComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">{{ heading }}</h1>
        <a class="ht-icon-btn ht-mobile-only" routerLink="/settings" aria-label="Settings"><app-icon name="gear" /></a>
      </header>

      <div class="ht-views" role="tablist" aria-label="Card style">
        @for (item of views; track item.id) {
          <button type="button" role="tab" [class.is-on]="view() === item.id" [attr.aria-selected]="view() === item.id" (click)="view.set(item.id)">
            {{ item.label }}
          </button>
        }
      </div>

      <div class="ht-toolbar">
        <label class="ht-search">
          <app-icon name="search" />
          <input type="search" placeholder="Search habits" [value]="query()" (input)="query.set(inputValue($event))" aria-label="Search habits" />
        </label>
        <select class="ht-select" aria-label="Category" [value]="category()" (change)="category.set(inputValue($event))">
          <option value="">All categories</option>
          @for (item of categories(); track item) { <option [value]="item">{{ item }}</option> }
        </select>
        <select class="ht-select" aria-label="Frequency" [value]="frequency()" (change)="frequency.set($any(inputValue($event)))">
          <option value="">Any frequency</option>
          @for (item of frequencies; track item.value) { <option [value]="item.value">{{ item.label }}</option> }
        </select>
      </div>

      <div class="ht-chips" role="group" aria-label="Status">
        @for (item of statuses; track item.id) {
          <button type="button" class="ht-chip" [class.is-on]="status() === item.id" (click)="status.set(item.id)">
            {{ item.label }} <span class="ht-muted">{{ counts()[item.id] }}</span>
          </button>
        }
        <button type="button" class="ht-chip" [class.is-on]="grouped()" (click)="grouped.set(!grouped())">Group by category</button>
      </div>

      @for (group of groups(); track group.name) {
        @if (grouped()) {
          <h2 class="ht-group"><span>{{ group.name }}</span><span>{{ group.habits.length }}</span></h2>
        }
        <div class="ht-grid ht-grid--2">
          @for (habit of group.habits; track habit.id) {
            <article class="ht-card" [style.border-color]="habitColor(habit) + '55'">
              <div class="ht-card__head">
                <a class="ht-card__link" [routerLink]="['/habits', habit.id]">
                  <span class="ht-badge" [style.background]="habitColor(habit)"><app-icon [name]="habit.icon || 'star'" /></span>
                  <div>
                    <h2 class="ht-card__name">{{ habit.name }}</h2>
                    <p class="ht-card__meta">🔥 {{ meta(habit) }}</p>
                  </div>
                </a>
                <div class="ht-card__tools">
                  @if (habit.active) {
                    @if (habit.kind === 'measurable') {
                      <button type="button" class="ht-check" [class.is-part]="amount(habit, now) > 0" [class.is-on]="done(habit, now)"
                              [attr.aria-label]="'Add one ' + (habit.unit || '') + ' to ' + habit.name" (click)="bump(habit, now)">
                        @if (amount(habit, now) > 0 && !done(habit, now)) { {{ amount(habit, now) }} } @else { <app-icon name="plus" /> }
                      </button>
                    } @else {
                      <button type="button" class="ht-check" [class.is-on]="done(habit, now)" [class.is-part]="!done(habit, now) && amount(habit, now) > 0"
                              [attr.aria-pressed]="done(habit, now)" [attr.aria-label]="(done(habit, now) ? 'Undo ' : 'Complete ') + habit.name"
                              (click)="bump(habit, now)">
                        @if (!done(habit, now) && amount(habit, now) > 0) { {{ amount(habit, now) }}/{{ target(habit) }} } @else { <app-icon name="check" /> }
                      </button>
                    }
                  }
                  <button type="button" class="ht-icon-btn" aria-label="Habit actions" (click)="menuId.set(menuId() === habit.id ? null : habit.id)">
                    <app-icon name="more" />
                  </button>
                </div>
              </div>

              @if (view() === 'tick') {
                <div class="ht-heat" aria-hidden="true">
                  <div class="ht-heat__labels">
                    @for (label of heatLabels; track $index) { <span>{{ label }}</span> }
                  </div>
                  <div class="ht-heat__grid">
                    @for (column of heat; track $index) {
                      <div class="ht-heat__col">
                        @for (day of column; track day.getTime()) {
                          <span class="ht-dot" [class.is-on]="done(habit, day)" [class.is-future]="day > now"
                                [style.background]="done(habit, day) ? habitColor(habit) : null"></span>
                        }
                      </div>
                    }
                  </div>
                </div>
              } @else if (view() === 'weekly') {
                <div class="ht-week">
                  @for (day of week; track day.getTime()) {
                    <button type="button" class="ht-day" [class.is-on]="done(habit, day)" [class.is-today]="isToday(day)"
                            [disabled]="day > now || !habit.active" [style.background]="done(habit, day) ? habitColor(habit) : null"
                            [attr.aria-label]="weekdayLong(day) + ' ' + habit.name" (click)="bump(habit, day)">
                      <small>{{ weekday(day) }}</small>
                      @if (habit.kind === 'measurable' || target(habit) > 1) { {{ amount(habit, day) || '' }} } @else if (done(habit, day)) { ✓ }
                    </button>
                  }
                </div>
              } @else {
                <div class="ht-measure">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        @for (weekStart of measureWeeks; track weekStart.getTime()) { <th>{{ shortDay(weekStart) }}</th> }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of measureRows; track row.label) {
                        <tr>
                          <th>{{ row.label }}</th>
                          @for (weekStart of measureWeeks; track weekStart.getTime()) {
                            <td>
                              @if (row.offset >= 0) {
                                <button type="button" class="ht-cell" [class.is-hot]="done(habit, offset(weekStart, row.offset))"
                                        [class.is-today]="isToday(offset(weekStart, row.offset))"
                                        [disabled]="offset(weekStart, row.offset) > now || !habit.active"
                                        (click)="bump(habit, offset(weekStart, row.offset))">
                                  {{ amount(habit, offset(weekStart, row.offset)) }}
                                  <small>{{ habit.unit || 'times' }}</small>
                                </button>
                              } @else {
                                <span class="ht-cell" [class.is-hot]="weekTotal(habit, weekStart) > 0">{{ weekTotal(habit, weekStart) }}</span>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              @if (menuId() === habit.id) {
                <div class="ht-menu">
                  <a [routerLink]="['/habits', habit.id]"><app-icon name="stats" /> Open</a>
                  <a [routerLink]="['/habits', habit.id, 'edit']"><app-icon name="pencil" /> Edit</a>
                  @if (habit.active) {
                    <button type="button" (click)="archive(habit)"><app-icon name="archive" /> Archive</button>
                  } @else {
                    <button type="button" (click)="restore(habit)"><app-icon name="reset" /> Restore</button>
                  }
                  <button type="button" class="danger" (click)="pendingDelete.set(habit)"><app-icon name="trash" /> Delete</button>
                </div>
              }
            </article>
          }
        </div>
      } @empty {
        <div class="ht-empty">
          @if (inView().length) {
            <p>No habits match these filters.</p>
            <button type="button" class="btn btn--secondary" (click)="clearFilters()">Clear filters</button>
          } @else {
            <p>{{ view() === 'measure' ? 'No measurable habits yet.' : view() === 'tick' ? 'No tick habits yet.' : 'No habits yet.' }}</p>
            <a class="btn btn--primary" routerLink="/habits/new"><app-icon name="plus" /> Add a habit</a>
          }
        </div>
      }
    </section>

    <app-confirmation-dialog
      [open]="!!pendingDelete()"
      title="Delete habit"
      [message]="'Delete ' + (pendingDelete()?.name || 'this habit') + '? Its history and goals will be removed.'"
      confirmLabel="Delete"
      (cancelled)="pendingDelete.set(null)"
      (confirmed)="confirmDelete()" />
  `,
})
export class HomeComponent {
  private readonly habitsService = inject(HabitService);
  private readonly completionService = inject(HabitCompletionService);
  readonly habits = toSignal(this.habitsService.habits$, { initialValue: this.habitsService.getAll() });
  private readonly completions = toSignal(this.completionService.completions$, { initialValue: this.completionService.getAll() });

  readonly views: { id: HomeView; label: string }[] = [
    { id: 'measure', label: 'Measure' },
    { id: 'tick', label: 'Tick' },
    { id: 'weekly', label: 'Weekly' },
  ];
  readonly statuses: { id: StatusFilter; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'todo', label: 'To do today' },
    { id: 'done', label: 'Completed today' },
    { id: 'missed', label: 'Missed this week' },
    { id: 'archived', label: 'Archived' },
  ];
  readonly frequencies = FREQUENCY_OPTIONS;
  readonly heatLabels = ['M', '', 'W', '', 'F', '', 'S'];
  readonly measureRows = [
    { label: 'Mon', offset: 0 }, { label: 'Tue', offset: 1 }, { label: 'Wed', offset: 2 }, { label: 'Thu', offset: 3 },
    { label: 'Fri', offset: 4 }, { label: 'Sat', offset: 5 }, { label: 'Sun', offset: 6 }, { label: 'Total', offset: -1 },
  ];
  readonly heading = todayLabel();
  readonly now = new Date();
  readonly todayKey = toDateKey(this.now);
  readonly week = weekDates(this.now);
  readonly heat = heatmapWeeks(this.now);
  readonly measureWeeks = [3, 2, 1, 0].map((ago) => addDays(startOfWeek(this.now), -7 * ago));

  readonly view = signal<HomeView>('tick');
  readonly query = signal('');
  readonly category = signal('');
  readonly frequency = signal<HabitFrequency | ''>('');
  readonly status = signal<StatusFilter>('active');
  readonly grouped = signal(false);
  readonly menuId = signal<number | null>(null);
  readonly pendingDelete = signal<Habit | null>(null);

  private readonly index = computed(() => indexCompletions(this.completions()));
  readonly categories = computed(() => [...new Set(this.habits().map((habit) => habit.category))].sort());

  private readonly matchesStatus = computed(() => {
    const index = this.index();
    const weekStart = startOfWeek(this.now);
    const yesterday = addDays(this.now, -1);
    const tests: Record<StatusFilter, (habit: Habit) => boolean> = {
      active: (habit) => habit.active,
      archived: (habit) => !habit.active,
      done: (habit) => habit.active && isDoneOn(habit, index, this.todayKey),
      todo: (habit) => habit.active && dayState(habit, index, this.now, this.now) === 'open'
        && (!isFlexible(habit) || doneDaysBetween(habit, index, weekStart, this.now) < weeklyTarget(habit)),
      missed: (habit) => {
        if (!habit.active || weekStart > yesterday) {
          return false;
        }
        const tally = rangeTally(habit, index, weekStart, yesterday, this.now);
        return tally.due > tally.done;
      },
    };
    return tests;
  });

  readonly inView = computed(() => {
    const view = this.view();
    if (view === 'weekly') {
      return this.habits();
    }
    return this.habits().filter((habit) => (view === 'measure') === (habit.kind === 'measurable'));
  });

  readonly counts = computed(() => {
    const tests = this.matchesStatus();
    const result = {} as Record<StatusFilter, number>;
    for (const item of this.statuses) {
      result[item.id] = this.inView().filter(tests[item.id]).length;
    }
    return result;
  });

  readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    const frequency = this.frequency();
    const test = this.matchesStatus()[this.status()];
    return this.inView().filter((habit) => test(habit)
      && (!category || habit.category === category)
      && (!frequency || habit.frequency === frequency)
      && (!query || `${habit.name} ${habit.description ?? ''} ${habit.category}`.toLowerCase().includes(query)));
  });

  readonly groups = computed(() => {
    const habits = this.visible();
    if (!habits.length) {
      return [];
    }
    if (!this.grouped()) {
      return [{ name: 'all', habits }];
    }
    const map = new Map<string, Habit[]>();
    for (const habit of habits) {
      map.set(habit.category, [...(map.get(habit.category) ?? []), habit]);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, list]) => ({ name, habits: list }));
  });

  readonly habitColor = habitColor;
  readonly shortDay = shortDay;

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.frequency.set('');
    this.status.set('active');
  }

  offset(weekStart: Date, days: number): Date {
    return addDays(weekStart, days);
  }

  amount(habit: Habit, date: Date): number {
    return amountOn(habit, this.index(), toDateKey(date));
  }

  done(habit: Habit, date: Date): boolean {
    return isDoneOn(habit, this.index(), toDateKey(date));
  }

  target(habit: Habit): number {
    return dailyTarget(habit);
  }

  weekTotal(habit: Habit, weekStart: Date): number {
    return Array.from({ length: 7 }, (_, day) => this.amount(habit, addDays(weekStart, day))).reduce((sum, value) => sum + value, 0);
  }

  isToday(date: Date): boolean {
    return toDateKey(date) === this.todayKey;
  }

  weekday(date: Date): string {
    return date.toLocaleDateString('en-GB', { weekday: 'narrow' });
  }

  weekdayLong(date: Date): string {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }

  meta(habit: Habit): string {
    const stats = habitStats(habit, this.index(), this.now);
    const streak = `${stats.current}${stats.unit === 'week' ? ' wk' : ''}`;
    const parts = [streak, frequencyLabel(habit)];
    if (habit.kind === 'measurable') {
      parts.push(`${this.amount(habit, this.now)}/${habit.target} ${habit.unit}`);
    } else if (isFlexible(habit)) {
      parts.push(`${doneDaysBetween(habit, this.index(), startOfWeek(this.now), this.now)}/${weeklyTarget(habit)} this week`);
    }
    if (!habit.active) {
      parts.push('Archived');
    }
    return parts.join(' · ');
  }

  bump(habit: Habit, date: Date): void {
    const key = toDateKey(date);
    if (habit.kind === 'measurable') {
      this.completionService.step(habit, key, 1);
      return;
    }
    const target = dailyTarget(habit);
    const current = this.amount(habit, date);
    this.completionService.setValue(habit.id, key, current >= target ? 0 : current + 1);
  }

  archive(habit: Habit): void {
    this.menuId.set(null);
    this.habitsService.archive(habit.id);
  }

  restore(habit: Habit): void {
    this.menuId.set(null);
    this.habitsService.restore(habit.id);
  }

  confirmDelete(): void {
    const habit = this.pendingDelete();
    if (habit) {
      this.habitsService.delete(habit.id);
    }
    this.pendingDelete.set(null);
    this.menuId.set(null);
  }
}
