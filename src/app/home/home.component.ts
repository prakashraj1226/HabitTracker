import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ConfirmationDialogComponent } from '../common/confirmation-dialog/confirmation-dialog.component';
import { IconComponent } from '../common/icon/icon.component';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { addDays, startOfWeek, toDateKey, weekDates } from '../core/utils/date.util';
import {
  amountOf,
  findCompletion,
  habitColor,
  habitKind,
  habitRepeat,
  heatmapWeeks,
  isDone,
  shortMonth,
  streakCount,
  todayLabel,
  weekAmount,
  weekProgress,
} from '../core/utils/habit-view.util';
import { Habit } from '../core/models/habit.model';

type HomeView = 'measure' | 'tick' | 'weekly';

@Component({
  selector: 'app-home',
  imports: [RouterLink, IconComponent, ConfirmationDialogComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">{{ heading }}</h1>
        <a class="ht-icon-btn" routerLink="/settings" aria-label="Settings">
          <app-icon name="settings" />
        </a>
      </header>

      <div class="ht-views" role="tablist">
        @for (item of views; track item.id) {
          <button type="button" role="tab" [class.is-on]="view() === item.id" [attr.aria-selected]="view() === item.id" (click)="view.set(item.id)">
            {{ item.label }}
          </button>
        }
      </div>

      @if (categories().length) {
        <div class="ht-chips">
          @for (category of categories(); track category) {
            <button type="button" class="ht-chip" [class.is-on]="categoryFilter() === category" (click)="toggleCategory(category)">
              {{ category }}
            </button>
          }
        </div>
      }

      <div class="ht-stack">
        @for (habit of visible(); track habit.id) {
          <article class="ht-card" [style.border-color]="habitColor(habit) + '55'">
            <div class="ht-card__head">
              <span class="ht-badge" [style.background]="habitColor(habit)">
                <app-icon [name]="habit.icon || 'star'" />
              </span>
              <div>
                <h2 class="ht-card__name">{{ habit.name }}</h2>
                <p class="ht-card__meta">
                  <app-icon name="flame" />
                  <span>{{ meta(habit) }}</span>
                </p>
              </div>
              <div class="ht-card__tools">
                @if (view() === 'measure') {
                  <button type="button" class="ht-icon-btn" aria-label="Reset today" (click)="resetToday(habit)">
                    <app-icon name="reset" />
                  </button>
                  <button type="button" class="ht-check" aria-label="Add one for today" (click)="addOne(habit, todayKey)">
                    <app-icon name="plus" />
                  </button>
                } @else if (view() === 'tick') {
                  <button type="button" class="ht-check" [class.is-on]="doneToday(habit)" [attr.aria-pressed]="doneToday(habit)" [attr.aria-label]="doneToday(habit) ? 'Mark not done' : 'Mark done'" (click)="tickToday(habit)">
                    <app-icon name="check" />
                  </button>
                }
                <button type="button" class="ht-icon-btn" aria-label="Habit actions" (click)="menuId.set(menuId() === habit.id ? null : habit.id)">
                  <app-icon name="more" />
                </button>
              </div>
            </div>

            @if (view() === 'tick') {
              <div class="ht-heat" aria-hidden="true">
                <div class="ht-heat__labels">
                  @for (label of heatLabels; track label) {
                    <span>{{ label }}</span>
                  }
                </div>
                <div class="ht-heat__grid">
                  @for (column of heat; track $index) {
                    <div class="ht-heat__col">
                      @for (day of column; track day.getTime()) {
                        <span class="ht-dot" [class.is-on]="isDone(find(habit, day))" [class.is-future]="day > now" [style.background]="isDone(find(habit, day)) ? habitColor(habit) : null"></span>
                      }
                    </div>
                  }
                </div>
              </div>
            } @else if (view() === 'weekly') {
              <div class="ht-week">
                @for (day of week; track day.getTime()) {
                  <button type="button" class="ht-day" [class.is-on]="isDone(find(habit, day))" [class.is-today]="same(day)" [style.background]="isDone(find(habit, day)) ? habitColor(habit) : null" (click)="onDay(habit, day)">
                    <small>{{ weekday(day) }}</small>
                    @if (habitKind(habit) === 'measurable') {
                      {{ amount(habit, day) || '' }}
                    } @else if (isDone(find(habit, day))) {
                      ✓
                    }
                  </button>
                }
              </div>
            } @else {
              <div class="ht-measure">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      @for (weekStart of measureWeeks; track weekStart.getTime()) {
                        <th>{{ shortMonth(weekStart) }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of measureRows; track row.label) {
                      <tr>
                        <th>{{ row.label }}</th>
                        @for (weekStart of measureWeeks; track weekStart.getTime()) {
                          <td>
                            @if (row.offset >= 0) {
                              <button type="button" class="ht-cell" [class.is-hot]="amount(habit, addDays(weekStart, row.offset)) > 0" [class.is-today]="same(addDays(weekStart, row.offset))" (click)="addOne(habit, toDateKey(addDays(weekStart, row.offset)))">
                                {{ amount(habit, addDays(weekStart, row.offset)) }}
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
                <a routerLink="/habits/{{ habit.id }}/edit"><app-icon name="pencil" /> Edit</a>
                <button type="button" (click)="archive(habit)"><app-icon name="archive" /> Archive</button>
                <button type="button" class="danger" (click)="pendingDelete.set(habit)"><app-icon name="trash" /> Delete</button>
              </div>
            }
          </article>
        } @empty {
          <div class="ht-empty">
            <p>No habits in this view yet.</p>
            <a routerLink="/habits/new">Add a habit</a>
          </div>
        }
      </div>
    </section>

    <app-confirmation-dialog
      [open]="!!pendingDelete()"
      title="Delete habit"
      [message]="'Delete ' + (pendingDelete()?.name || 'this habit') + '? Its history will be removed.'"
      confirmLabel="Delete"
      (cancelled)="pendingDelete.set(null)"
      (confirmed)="confirmDelete()" />
  `,
})
export class HomeComponent {
  private readonly habitsService = inject(HabitService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly habits = toSignal(this.habitsService.habits$, { initialValue: this.habitsService.getAll() });
  private readonly completions = toSignal(this.completionService.completions$, { initialValue: this.completionService.getAll() });

  readonly views: { id: HomeView; label: string }[] = [
    { id: 'measure', label: 'Measure' },
    { id: 'tick', label: 'Tick' },
    { id: 'weekly', label: 'Weekly' },
  ];
  readonly heatLabels = ['M', '', 'W', '', 'F', '', 'S'];
  readonly measureRows = [
    { label: 'Mon', offset: 0 },
    { label: 'Tue', offset: 1 },
    { label: 'Wed', offset: 2 },
    { label: 'Thu', offset: 3 },
    { label: 'Fri', offset: 4 },
    { label: 'Sat', offset: 5 },
    { label: 'Sun', offset: 6 },
    { label: 'Total', offset: -1 },
  ];
  readonly heading = todayLabel();
  readonly now = new Date();
  readonly todayKey = toDateKey(this.now);
  readonly week = weekDates(this.now);
  readonly heat = heatmapWeeks(this.now);
  readonly measureWeeks = [3, 2, 1, 0].map((ago) => addDays(startOfWeek(this.now), -7 * ago));
  readonly view = signal<HomeView>('tick');
  readonly categoryFilter = signal<string | null>(null);
  readonly menuId = signal<number | null>(null);
  readonly pendingDelete = signal<Habit | null>(null);

  readonly categories = computed(() => [...new Set(this.active().map((habit) => habit.category))]);
  readonly visible = computed(() => {
    const category = this.categoryFilter();
    return this.active().filter((habit) => {
      if (category && habit.category !== category) {
        return false;
      }
      if (this.view() === 'measure') {
        return habitKind(habit) === 'measurable';
      }
      if (this.view() === 'tick') {
        return habitKind(habit) === 'tick';
      }
      return true;
    });
  });

  habitKind = habitKind;
  habitColor = habitColor;
  isDone = isDone;
  findCompletion = findCompletion;
  shortMonth = shortMonth;
  addDays = addDays;
  toDateKey = toDateKey;

  toggleCategory(category: string): void {
    this.categoryFilter.set(this.categoryFilter() === category ? null : category);
  }

  find(habit: Habit, date: Date) {
    return findCompletion(this.completions() ?? [], habit.id, toDateKey(date));
  }

  amount(habit: Habit, date: Date): number {
    return amountOf(this.find(habit, date));
  }

  weekTotal(habit: Habit, weekStart: Date): number {
    return weekAmount(habit.id, this.completions() ?? [], Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  }

  doneToday(habit: Habit): boolean {
    return isDone(this.find(habit, this.now));
  }

  same(date: Date): boolean {
    return toDateKey(date) === this.todayKey;
  }

  weekday(date: Date): string {
    return date.toLocaleDateString('en-GB', { weekday: 'narrow' });
  }

  meta(habit: Habit): string {
    const streak = streakCount(habit.id, this.completions() ?? [], this.now);
    if (this.view() === 'weekly') {
      if (habitKind(habit) === 'measurable') {
        const total = weekAmount(habit.id, this.completions() ?? [], this.week);
        return `Streak: ${streak} · ${total} ${habit.unit || 'times'} this week`;
      }
      const progress = weekProgress(habit.id, this.completions() ?? [], this.week);
      return `Streak: ${streak} · ${progress.done}/${progress.total} days`;
    }
    if (habitKind(habit) === 'measurable') {
      const today = amountOf(this.find(habit, this.now));
      return `Streak: ${streak} · ${today}/${habit.target || 1} ${habit.unit || 'times'}`;
    }
    return `Streak: ${streak}`;
  }

  tickToday(habit: Habit): void {
    if (habitRepeat(habit) === 'multiple') {
      this.addOne(habit, this.todayKey);
      return;
    }
    this.completionService.toggle(habit.id, this.todayKey);
  }

  onDay(habit: Habit, date: Date): void {
    const key = toDateKey(date);
    if (habitKind(habit) === 'measurable' || habitRepeat(habit) === 'multiple') {
      this.addOne(habit, key);
      return;
    }
    this.completionService.toggle(habit.id, key);
  }

  addOne(habit: Habit, date: string): void {
    const current = amountOf(findCompletion(this.completions() ?? [], habit.id, date));
    const cap = habitKind(habit) === 'tick' ? habit.target || 2 : 99;
    const next = current >= cap && habitKind(habit) === 'tick' ? 0 : current + 1;
    this.completionService.setValue(habit.id, date, next);
  }

  resetToday(habit: Habit): void {
    this.completionService.setValue(habit.id, this.todayKey, 0);
  }

  archive(habit: Habit): void {
    this.menuId.set(null);
    this.habitsService.archive(habit.id);
  }

  confirmDelete(): void {
    const habit = this.pendingDelete();
    if (!habit) {
      return;
    }
    this.habitsService.delete(habit.id);
    this.pendingDelete.set(null);
    this.menuId.set(null);
  }

  private active(): Habit[] {
    return (this.habits() ?? []).filter((habit) => habit.active !== false);
  }
}
