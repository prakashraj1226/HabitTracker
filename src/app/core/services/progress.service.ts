import { Injectable } from '@angular/core';
import { Habit } from '../models/habit.model';
import { HabitCompletion } from '../models/habit-completion.model';
import {
  CalendarCell,
  DayBar,
  DayDetail,
  HabitSummary,
  HistoryEntry,
  ProgressRatio,
  StreakSnapshot,
} from '../models/progress.model';
import { endOfMonth, startOfMonth, startOfWeek, addDays } from '../utils/date.util';
import {
  buildMonthCells,
  buildMonthSeries,
  buildWeekBars,
  canToggleHabit,
  describeDay,
  globalStreak,
  habitHistory,
  overallProgress,
  periodProgress,
  summarizeHabit,
} from '../utils/progress.util';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  summarize(habits: Habit[], completions: HabitCompletion[], today = new Date()): HabitSummary[] {
    return habits.map((habit) => summarizeHabit(habit, completions, today));
  }

  daily(habits: Habit[], completions: HabitCompletion[], today = new Date()): ProgressRatio {
    return periodProgress(habits, completions, today, today, today, true);
  }

  weekly(habits: Habit[], completions: HabitCompletion[], today = new Date()): ProgressRatio {
    const start = startOfWeek(today);
    return periodProgress(habits, completions, start, addDays(start, 6), today, true);
  }

  lastWeek(habits: Habit[], completions: HabitCompletion[], today = new Date()): ProgressRatio {
    const start = addDays(startOfWeek(today), -7);
    return periodProgress(habits, completions, start, addDays(start, 6), today, true);
  }

  monthly(habits: Habit[], completions: HabitCompletion[], month: Date, today = new Date()): ProgressRatio {
    return periodProgress(habits, completions, startOfMonth(month), endOfMonth(month), today, true);
  }

  overall(habits: Habit[], completions: HabitCompletion[], today = new Date()): ProgressRatio {
    return overallProgress(habits, completions, today);
  }

  streaks(habits: Habit[], completions: HabitCompletion[], today = new Date()): StreakSnapshot {
    return globalStreak(habits, completions, today);
  }

  weekBars(habits: Habit[], completions: HabitCompletion[], today = new Date(), habitId?: number): DayBar[] {
    return buildWeekBars(habits, completions, today, habitId);
  }

  monthSeries(habits: Habit[], completions: HabitCompletion[], month: Date, today = new Date(), habitId?: number): DayBar[] {
    return buildMonthSeries(habits, completions, month, today, habitId);
  }

  monthCells(
    year: number,
    month: number,
    habits: Habit[],
    completions: HabitCompletion[],
    today = new Date(),
    activeOnly = true,
  ): CalendarCell[] {
    return buildMonthCells(year, month, habits, completions, today, activeOnly);
  }

  day(habits: Habit[], completions: HabitCompletion[], dateKey: string, today = new Date()): DayDetail {
    return describeDay(habits, completions, dateKey, today);
  }

  history(habit: Habit, completions: HabitCompletion[], today = new Date()): HistoryEntry[] {
    return habitHistory(habit, completions, today);
  }

  canToggle(habit: Habit, dateKey: string, today = new Date()): boolean {
    return canToggleHabit(habit, dateKey, today);
  }
}
