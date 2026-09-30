import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { CommonButtonComponent } from '../../common/common-button/common-button.component';
import { ConfirmationDialogComponent } from '../../common/confirmation-dialog/confirmation-dialog.component';
import { EmptyStateComponent } from '../../common/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../common/loading-spinner/loading-spinner.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { IconComponent } from '../../common/icon/icon.component';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '../../core/constants/habit.constants';
import { Habit } from '../../core/models/habit.model';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { HabitService } from '../../core/services/habit.service';
import { ProgressService } from '../../core/services/progress.service';
import { toDateKey } from '../../core/utils/date.util';
import { frequencyLabel, habitStatus, readNotice, statusBadge, streakLabel } from '../../core/utils/habit-format';
import { HabitProgressComponent } from '../habit-progress/habit-progress.component';

@Component({
  selector: 'app-habit-list',
  imports: [
    RouterLink,
    PageHeaderComponent,
    CommonButtonComponent,
    ConfirmationDialogComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    IconComponent,
    HabitProgressComponent,
  ],
  templateUrl: './habit-list.component.html',
})
export class HabitListComponent {
  private readonly habitService = inject(HabitService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly progress = inject(ProgressService);

  readonly query = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive' | 'today'>('all');
  readonly pendingDelete = signal<Habit | null>(null);
  readonly notice = signal(readNotice());
  readonly actionError = signal<string | null>(null);
  readonly frequencyLabel = frequencyLabel;
  readonly streakLabel = streakLabel;
  readonly habitStatus = habitStatus;
  readonly statusBadge = statusBadge;
  readonly fallbackColor = DEFAULT_HABIT_COLOR;
  readonly fallbackIcon = DEFAULT_HABIT_ICON;

  private readonly data = toSignal(
    combineLatest([
      this.habitService.habits$,
      this.completionService.completions$,
      this.habitService.error$,
      this.completionService.error$,
    ]).pipe(map(([habits, completions, habitError, completionError]) => ({
      habits,
      completions,
      error: habitError ?? completionError,
    }))),
    { initialValue: null },
  );

  readonly summaries = computed(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    return this.progress.summarize(data.habits, data.completions);
  });

  readonly loading = computed(() => this.data() === null);
  readonly loadError = computed(() => this.data()?.error ?? null);
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.summaries().filter((item) => {
      const matchesQuery = !query
        || item.habit.name.toLowerCase().includes(query)
        || item.habit.category.toLowerCase().includes(query);
      const filter = this.statusFilter();
      const matchesStatus = filter === 'all'
        || (filter === 'active' && item.habit.active)
        || (filter === 'inactive' && !item.habit.active)
        || (filter === 'today' && item.dueToday);
      return matchesQuery && matchesStatus;
    });
  });

  markComplete(habit: Habit, dueToday: boolean): void {
    if (!dueToday) {
      return;
    }
    try {
      this.completionService.toggle(habit.id, toDateKey(new Date()));
      this.actionError.set(null);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'The habit could not be updated.');
    }
  }

  confirmDelete(): void {
    const habit = this.pendingDelete();
    if (!habit) {
      return;
    }
    try {
      this.habitService.delete(habit.id);
      this.pendingDelete.set(null);
      this.notice.set(`${habit.name} was deleted.`);
      this.actionError.set(null);
    } catch (error) {
      this.pendingDelete.set(null);
      this.actionError.set(error instanceof Error ? error.message : 'The habit could not be deleted.');
    }
  }
}
