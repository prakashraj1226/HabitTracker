import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { CommonButtonComponent } from '../common/common-button/common-button.component';
import { CommonCardComponent } from '../common/common-card/common-card.component';
import { EmptyStateComponent } from '../common/empty-state/empty-state.component';
import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { IconComponent } from '../common/icon/icon.component';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '../core/constants/habit.constants';
import { Habit } from '../core/models/habit.model';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { ProgressService } from '../core/services/progress.service';
import { formatLongDate, formatMonth, isValidDateKey, parseDateKey, startOfMonth, toDateKey } from '../core/utils/date.util';
import { HabitCalendarComponent } from '../habit/habit-calendar/habit-calendar.component';

@Component({
  selector: 'app-calendar',
  imports: [
    RouterLink,
    PageHeaderComponent,
    CommonCardComponent,
    CommonButtonComponent,
    EmptyStateComponent,
    IconComponent,
    HabitCalendarComponent,
  ],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent {
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly progress = inject(ProgressService);
  private readonly route = inject(ActivatedRoute);

  readonly selected = signal(toDateKey(new Date()));
  readonly monthCursor = signal(startOfMonth(new Date()));
  readonly error = signal<string | null>(null);
  readonly fallbackColor = DEFAULT_HABIT_COLOR;
  readonly fallbackIcon = DEFAULT_HABIT_ICON;

  private readonly data = toSignal(
    combineLatest([
      this.habits.habits$,
      this.completions.completions$,
      this.habits.error$,
      this.completions.error$,
    ]).pipe(map(([habits, completions, habitError, completionError]) => ({
      habits,
      completions,
      error: habitError ?? completionError,
    }))),
    { initialValue: null },
  );

  readonly view = computed(() => {
    const data = this.data();
    const month = this.monthCursor();
    const selected = this.selected();
    if (!data) {
      return null;
    }
    const today = new Date();
    const detail = this.progress.day(data.habits, data.completions, selected, today);
    return {
      error: data.error,
      monthLabel: formatMonth(month),
      cells: this.progress.monthCells(month.getFullYear(), month.getMonth(), data.habits, data.completions, today, true),
      detail,
      title: formatLongDate(parseDateKey(selected)),
      hasHabits: data.habits.length > 0,
    };
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const date = params.get('date');
      if (date && isValidDateKey(date)) {
        this.selected.set(date);
        this.monthCursor.set(startOfMonth(parseDateKey(date)));
      }
    });
  }

  select(date: string): void {
    this.selected.set(date);
  }

  shiftMonth(offset: number): void {
    const current = this.monthCursor();
    const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    this.monthCursor.set(next);
    const prefix = toDateKey(next).slice(0, 7);
    if (!this.selected().startsWith(prefix)) {
      const today = toDateKey(new Date());
      this.selected.set(today.startsWith(prefix) ? today : toDateKey(next));
    }
  }

  toggle(habit: Habit): void {
    if (!this.progress.canToggle(habit, this.selected())) {
      return;
    }
    try {
      this.completions.toggle(habit.id, this.selected());
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The completion could not be saved.');
    }
  }
}
