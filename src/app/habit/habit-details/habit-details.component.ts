import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { CommonButtonComponent } from '../../common/common-button/common-button.component';
import { CommonCardComponent } from '../../common/common-card/common-card.component';
import { ConfirmationDialogComponent } from '../../common/confirmation-dialog/confirmation-dialog.component';
import { EmptyStateComponent } from '../../common/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../common/loading-spinner/loading-spinner.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { StatCardComponent } from '../../common/stat-card/stat-card.component';
import { IconComponent } from '../../common/icon/icon.component';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '../../core/constants/habit.constants';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { HabitService } from '../../core/services/habit.service';
import { ProgressService } from '../../core/services/progress.service';
import { formatMediumDate, formatMonth, parseDateKey, startOfMonth } from '../../core/utils/date.util';
import { frequencyLabel, habitStatus, readNotice, statusBadge, streakLabel } from '../../core/utils/habit-format';
import { HabitCalendarComponent } from '../habit-calendar/habit-calendar.component';
import { LineChartComponent } from '../habit-progress/line-chart.component';
import { WeekBarsComponent } from '../habit-progress/week-bars.component';

@Component({
  selector: 'app-habit-details',
  imports: [
    RouterLink,
    PageHeaderComponent,
    CommonCardComponent,
    CommonButtonComponent,
    ConfirmationDialogComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    StatCardComponent,
    IconComponent,
    HabitCalendarComponent,
    LineChartComponent,
    WeekBarsComponent,
  ],
  templateUrl: './habit-details.component.html',
})
export class HabitDetailsComponent {
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly progress = inject(ProgressService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly notice = signal(readNotice());
  readonly error = signal<string | null>(null);
  readonly confirmDelete = signal(false);
  readonly monthCursor = signal(startOfMonth(new Date()));
  readonly frequencyLabel = frequencyLabel;
  readonly streakLabel = streakLabel;
  readonly habitStatus = habitStatus;
  readonly statusBadge = statusBadge;
  readonly formatMonth = formatMonth;
  readonly fallbackColor = DEFAULT_HABIT_COLOR;
  readonly fallbackIcon = DEFAULT_HABIT_ICON;
  private readonly habitId = signal(Number(this.route.snapshot.paramMap.get('id')));

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
    if (!data) {
      return { status: 'loading' as const };
    }
    const habit = data.habits.find((item) => item.id === this.habitId());
    if (!habit) {
      return { status: 'missing' as const, error: data.error };
    }
    const summary = this.progress.summarize([habit], data.completions)[0];
    const month = this.monthCursor();
    return {
      status: 'ready' as const,
      error: data.error,
      summary,
      week: this.progress.weekBars(data.habits, data.completions, new Date(), habit.id),
      monthLabel: formatMonth(month),
      monthSeries: this.progress.monthSeries([habit], data.completions, month, new Date(), habit.id),
      cells: this.progress.monthCells(month.getFullYear(), month.getMonth(), [habit], data.completions, new Date(), false),
      history: this.progress.history(habit, data.completions),
      started: formatMediumDate(parseDateKey(habit.startDate)),
    };
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.habitId.set(Number(params.get('id')));
      this.monthCursor.set(startOfMonth(new Date()));
    });
    effect(() => {
      const view = this.view();
      const name = view.status === 'ready' ? view.summary.habit.name : 'Habit';
      this.title.setTitle(`${name} · Habit Tracker`);
    });
  }

  shiftMonth(offset: number): void {
    const current = this.monthCursor();
    this.monthCursor.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  toggleDate(date: string): void {
    const view = this.view();
    if (view.status !== 'ready') {
      return;
    }
    const habit = view.summary.habit;
    if (!this.progress.canToggle(habit, date)) {
      return;
    }
    try {
      this.completions.toggle(habit.id, date);
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The completion could not be saved.');
    }
  }

  deleteHabit(): void {
    const view = this.view();
    if (view.status !== 'ready') {
      return;
    }
    try {
      this.habits.delete(view.summary.habit.id);
      void this.router.navigate(['/habits'], { state: { notice: `${view.summary.habit.name} was deleted.` } });
    } catch (error) {
      this.confirmDelete.set(false);
      this.error.set(error instanceof Error ? error.message : 'The habit could not be deleted.');
    }
  }
}
