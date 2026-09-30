import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { EmptyStateComponent } from '../common/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../common/loading-spinner/loading-spinner.component';
import { Habit } from '../core/models/habit.model';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { ProgressService } from '../core/services/progress.service';
import { addDays, formatMonth, startOfMonth, startOfWeek, toDateKey, weekDates } from '../core/utils/date.util';
import { isScheduled } from '../core/utils/progress.util';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, EmptyStateComponent, LoadingSpinnerComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly progress = inject(ProgressService);
  private readonly router = inject(Router);

  readonly monthCursor = signal(startOfMonth(new Date()));

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
      return null;
    }
    const today = new Date();
    const todayKey = toDateKey(today);
    const month = this.monthCursor();
    const days = weekDates(today);
    const done = new Set(data.completions.filter((item) => item.completed).map((item) => `${item.habitId}|${item.date}`));
    const active = data.habits.filter((habit) => habit.active);
    const scores = days.map((date, index) => {
      const key = toDateKey(date);
      const due = active.filter((habit) => isScheduled(habit, date) && key <= todayKey);
      const completed = due.filter((habit) => done.has(`${habit.id}|${key}`)).length;
      const total = due.length;
      const future = key > todayKey;
      const score = future || total === 0 ? 0 : Math.round(((completed * 2 - total) / total) * 100);
      return { key, index, label: dayLabel(date), score, future, quiet: future || total === 0 };
    });
    return {
      error: data.error,
      hasHabits: data.habits.length > 0,
      monthLabel: formatMonth(month),
      lastWeek: this.progress.lastWeek(data.habits, data.completions, today),
      weekly: this.progress.weekly(data.habits, data.completions, today),
      daily: this.progress.daily(data.habits, data.completions, today),
      overall: this.progress.overall(data.habits, data.completions, today),
      columns: placeScores(scores),
      rows: active.map((habit) => ({
        habit,
        cells: days.map((date) => {
          const key = toDateKey(date);
          const due = isScheduled(habit, date);
          const future = key > todayKey;
          const completed = done.has(`${habit.id}|${key}`);
          const state: 'done' | 'miss' | 'empty' = !due || future ? 'empty' : completed ? 'done' : 'miss';
          return { date: key, state, canToggle: this.progress.canToggle(habit, key, today) };
        }),
      })),
      headers: days.map((date) => dayLabel(date)),
      weeks: monthWeeks(month, todayKey),
    };
  });

  readonly gauges = [
    { label: 'Last week', key: 'lastWeek' as const, color: '#4c8dff' },
    { label: 'This week', key: 'thisWeek' as const, color: '#2dd4bf' },
    { label: 'Today', key: 'today' as const, color: '#f5b942' },
  ];

  gaugeValue(data: { lastWeek: { percentage: number }; weekly: { percentage: number }; daily: { percentage: number } }, key: 'lastWeek' | 'thisWeek' | 'today'): number {
    if (key === 'lastWeek') {
      return data.lastWeek.percentage;
    }
    if (key === 'thisWeek') {
      return data.weekly.percentage;
    }
    return data.daily.percentage;
  }

  markColor(color?: string): string {
    if (!color) {
      return '#4c8dff';
    }
    return MARK_COLORS[color.toLowerCase()] ?? color;
  }

  ring(percentage: number): string {
    const radius = 30;
    const length = 2 * Math.PI * radius;
    const filled = length * (Math.max(0, Math.min(100, percentage)) / 100);
    return `${filled} ${length - filled}`;
  }

  shiftMonth(offset: number): void {
    const current = this.monthCursor();
    this.monthCursor.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  openDay(date: string): void {
    void this.router.navigate(['/calendar'], { queryParams: { date } });
  }

  toggle(habit: Habit, date: string, canToggle: boolean): void {
    if (!canToggle) {
      return;
    }
    try {
      this.completions.toggle(habit.id, date);
    } catch {
      // The dashboard banner reads the service error stream.
    }
  }
}

const MARK_COLORS: Record<string, string> = {
  '#1f5fbf': '#4c8dff',
  '#0f766e': '#2dd4bf',
  '#0369a1': '#22d3ee',
  '#3f6212': '#a3e635',
  '#b45309': '#fbbf24',
  '#b42318': '#fb7185',
  '#334155': '#94a3b8',
  '#3730a3': '#a78bfa',
};

function dayLabel(date: Date): string {
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date);
  return `${date.getDate()} ${month}`;
}

function monthWeeks(month: Date, todayKey: string) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = [];
  let cursor = startOfWeek(first);
  const end = startOfWeek(last);
  while (cursor.getTime() <= end.getTime()) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(cursor, index);
      return {
        key: toDateKey(date),
        date: toDateKey(date),
        label: String(date.getDate()),
        outside: date.getMonth() !== month.getMonth(),
      };
    });
    weeks.push({
      id: days[0].key,
      current: days.some((day) => day.date === todayKey),
      days,
    });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function placeScores(scores: { key: string; label: string; score: number; future: boolean; quiet: boolean }[]) {
  const width = 360;
  const mid = 78;
  const pad = 6;
  const slot = (width - pad * 2) / Math.max(scores.length, 1);
  const barWidth = 22;
  return scores.map((item, index) => {
    const height = item.quiet ? 0 : Math.max(4, (Math.abs(item.score) / 100) * 48);
    const up = item.score >= 0;
    const x = pad + slot * index + (slot - barWidth) / 2;
    const y = up ? mid - height : mid;
    return {
      ...item,
      x,
      y,
      h: height,
      w: barWidth,
      up,
      text: item.quiet ? '' : `${item.score > 0 ? '+' : ''}${item.score}%`,
      textY: up ? Math.max(12, y - 6) : y + height + 12,
      labelX: x + barWidth / 2,
    };
  });
}
