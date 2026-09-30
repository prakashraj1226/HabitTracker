import { Habit } from '../models/habit.model';
import { HabitCompletion } from '../models/habit-completion.model';
import {
  CalendarCell,
  DayBar,
  DayDetail,
  DayState,
  HabitSummary,
  HistoryEntry,
  ProgressRatio,
  StreakSnapshot,
} from '../models/progress.model';
import {
  addDays,
  formatLongDate,
  formatMediumDate,
  formatWeekday,
  isValidDateKey,
  parseDateKey,
  endOfMonth,
  startOfDay,
  startOfMonth,
  toDateKey,
  weekDates,
} from './date.util';

export function isScheduled(habit: Habit, date: Date): boolean {
  if (!isValidDateKey(habit.startDate)) {
    return false;
  }
  const key = toDateKey(date);
  if (key < habit.startDate) {
    return false;
  }
  if (habit.frequency === 'DAILY') {
    return true;
  }
  if (habit.frequency === 'WEEKLY') {
    return date.getDay() === parseDateKey(habit.startDate).getDay();
  }
  return (habit.daysOfWeek ?? []).includes(date.getDay());
}

export function canToggleHabit(habit: Habit, dateKey: string, today = new Date()): boolean {
  if (!isValidDateKey(dateKey) || dateKey > toDateKey(today)) {
    return false;
  }
  if (!isScheduled(habit, parseDateKey(dateKey))) {
    return false;
  }
  if (!habit.active && dateKey >= toDateKey(today)) {
    return false;
  }
  return true;
}

function completionSet(completions: HabitCompletion[]): Set<string> {
  const done = new Set<string>();
  for (const item of completions) {
    if (item.completed) {
      done.add(`${item.habitId}|${item.date}`);
    }
  }
  return done;
}

function counts(habit: Habit, date: Date, today: Date, activeOnly: boolean): boolean {
  if (!isScheduled(habit, date)) {
    return false;
  }
  if (habit.active) {
    return true;
  }
  if (activeOnly) {
    return false;
  }
  return toDateKey(date) < toDateKey(today);
}

function ratio(completed: number, total: number): ProgressRatio {
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function dayVisualState(dateKey: string, today: Date, total: number, completed: number): DayState {
  if (dateKey > toDateKey(today)) {
    return 'future';
  }
  if (total === 0) {
    return 'off';
  }
  if (completed === total) {
    return 'complete';
  }
  if (completed === 0) {
    return 'miss';
  }
  return 'partial';
}

export function summarizeHabit(habit: Habit, completions: HabitCompletion[], today = new Date()): HabitSummary {
  const done = completionSet(completions);
  const todayKey = toDateKey(today);
  let scheduledCount = 0;
  let completedCount = 0;
  let longest = 0;
  let run = 0;

  if (isValidDateKey(habit.startDate)) {
    let cursor = parseDateKey(habit.startDate);
    while (toDateKey(cursor) <= todayKey) {
      if (isScheduled(habit, cursor)) {
        scheduledCount += 1;
        const completed = done.has(`${habit.id}|${toDateKey(cursor)}`);
        if (completed) {
          completedCount += 1;
          run += 1;
          longest = Math.max(longest, run);
        } else if (toDateKey(cursor) !== todayKey) {
          run = 0;
        }
      }
      cursor = addDays(cursor, 1);
    }
  }

  let cursor = startOfDay(today);
  if (isScheduled(habit, cursor) && !done.has(`${habit.id}|${todayKey}`)) {
    cursor = addDays(cursor, -1);
  }
  let current = 0;
  for (let guard = 0; guard < 5000; guard += 1) {
    if (!isValidDateKey(habit.startDate) || toDateKey(cursor) < habit.startDate) {
      break;
    }
    if (isScheduled(habit, cursor)) {
      if (done.has(`${habit.id}|${toDateKey(cursor)}`)) {
        current += 1;
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  const dueToday = habit.active && isScheduled(habit, startOfDay(today));
  return {
    habit,
    currentStreak: current,
    longestStreak: longest,
    streakUnit: habit.frequency === 'WEEKLY' ? 'week' : 'day',
    completionPercentage: scheduledCount === 0 ? 0 : Math.round((completedCount / scheduledCount) * 100),
    completedCount,
    scheduledCount,
    dueToday,
    completedToday: dueToday && done.has(`${habit.id}|${todayKey}`),
  };
}

export function periodProgress(
  habits: Habit[],
  completions: HabitCompletion[],
  start: Date,
  end: Date,
  today = new Date(),
  activeOnly = true,
): ProgressRatio {
  const done = completionSet(completions);
  const lastKey = toDateKey(end) < toDateKey(today) ? toDateKey(startOfDay(end)) : toDateKey(today);
  const startKey = toDateKey(startOfDay(start));
  if (startKey > lastKey) {
    return ratio(0, 0);
  }
  let completed = 0;
  let total = 0;
  let cursor = startOfDay(start);
  while (toDateKey(cursor) <= lastKey) {
    const due = habits.filter((habit) => counts(habit, cursor, today, activeOnly));
    total += due.length;
    completed += due.filter((habit) => done.has(`${habit.id}|${toDateKey(cursor)}`)).length;
    cursor = addDays(cursor, 1);
  }
  return ratio(completed, total);
}

export function overallProgress(habits: Habit[], completions: HabitCompletion[], today = new Date()): ProgressRatio {
  const starts = habits.map((habit) => habit.startDate).filter(isValidDateKey).sort();
  if (!starts.length) {
    return ratio(0, 0);
  }
  return periodProgress(habits, completions, parseDateKey(starts[0]), today, today, false);
}

export function globalStreak(habits: Habit[], completions: HabitCompletion[], today = new Date()): StreakSnapshot {
  const relevant = habits.filter((habit) => habit.active && isValidDateKey(habit.startDate));
  if (!relevant.length) {
    return { current: 0, longest: 0 };
  }
  const done = completionSet(completions);
  const firstKey = relevant.map((habit) => habit.startDate).sort()[0];
  const todayKey = toDateKey(today);
  const stateFor = (date: Date): 'success' | 'fail' | 'skip' => {
    const due = relevant.filter((habit) => isScheduled(habit, date));
    if (!due.length) {
      return 'skip';
    }
    return due.every((habit) => done.has(`${habit.id}|${toDateKey(date)}`)) ? 'success' : 'fail';
  };

  let cursor = startOfDay(today);
  if (stateFor(cursor) === 'fail') {
    cursor = addDays(cursor, -1);
  }
  let current = 0;
  for (let guard = 0; guard < 5000; guard += 1) {
    if (toDateKey(cursor) < firstKey) {
      break;
    }
    const state = stateFor(cursor);
    if (state === 'fail') {
      break;
    }
    if (state === 'success') {
      current += 1;
    }
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  cursor = parseDateKey(firstKey);
  while (toDateKey(cursor) <= todayKey) {
    const state = stateFor(cursor);
    if (state === 'success') {
      run += 1;
      longest = Math.max(longest, run);
    } else if (state === 'fail' && toDateKey(cursor) !== todayKey) {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return { current, longest };
}

export function buildDayBars(
  habits: Habit[],
  completions: HabitCompletion[],
  dates: Date[],
  today = new Date(),
  activeOnly = true,
): DayBar[] {
  const done = completionSet(completions);
  return dates.map((date) => {
    const key = toDateKey(date);
    const due = habits.filter((habit) => counts(habit, date, today, activeOnly));
    const completed = due.filter((habit) => done.has(`${habit.id}|${key}`)).length;
    const total = due.length;
    const state = dayVisualState(key, today, total, completed);
    const percentage = total === 0 || state === 'future' ? 0 : Math.round((completed / total) * 100);
    return {
      date: key,
      label: formatWeekday(date),
      percentage,
      visual: state === 'miss' && total === 1 ? 100 : percentage,
      completed,
      total,
      state,
    };
  });
}

export function buildWeekBars(
  habits: Habit[],
  completions: HabitCompletion[],
  today = new Date(),
  habitId?: number,
): DayBar[] {
  const scoped = habitId == null ? habits : habits.filter((habit) => habit.id === habitId);
  return buildDayBars(scoped, completions, weekDates(today), today, habitId == null);
}

export function buildMonthSeries(
  habits: Habit[],
  completions: HabitCompletion[],
  month: Date,
  today = new Date(),
  habitId?: number,
): DayBar[] {
  const dates: Date[] = [];
  let cursor = startOfMonth(month);
  const lastKey = toDateKey(endOfMonth(month));
  while (toDateKey(cursor) <= lastKey) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  const scoped = habitId == null ? habits : habits.filter((habit) => habit.id === habitId);
  return buildDayBars(scoped, completions, dates, today, habitId == null);
}

export function buildMonthCells(
  year: number,
  month: number,
  habits: Habit[],
  completions: HabitCompletion[],
  today = new Date(),
  activeOnly = true,
): CalendarCell[] {
  const done = completionSet(completions);
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `pad-${month}-${index}`, date: null, label: '', state: 'pad', title: '' });
  }
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const due = habits.filter((habit) => counts(habit, date, today, activeOnly));
    const completed = due.filter((habit) => done.has(`${habit.id}|${key}`)).length;
    const state = dayVisualState(key, today, due.length, completed);
    const title = due.length === 0 ? formatLongDate(date) : `${formatLongDate(date)}: ${completed} of ${due.length} completed`;
    cells.push({ key, date: key, label: String(day), state, title });
  }
  return cells;
}

export function describeDay(
  habits: Habit[],
  completions: HabitCompletion[],
  dateKey: string,
  today = new Date(),
): DayDetail {
  const date = parseDateKey(dateKey);
  const done = completionSet(completions);
  const timing = dateKey > toDateKey(today) ? 'future' : dateKey === toDateKey(today) ? 'today' : 'past';
  const due = habits.filter((habit) => habit.active && isScheduled(habit, date));
  const completed = due.filter((habit) => done.has(`${habit.id}|${dateKey}`));
  const open = due.filter((habit) => !done.has(`${habit.id}|${dateKey}`));
  return {
    date: dateKey,
    total: due.length,
    completedCount: completed.length,
    percentage: timing === 'future' || due.length === 0 ? null : Math.round((completed.length / due.length) * 100),
    timing,
    completed,
    open,
  };
}

export function habitHistory(habit: Habit, completions: HabitCompletion[], today = new Date(), limit = 30): HistoryEntry[] {
  const done = completionSet(completions);
  const rows: HistoryEntry[] = [];
  if (!isValidDateKey(habit.startDate)) {
    return rows;
  }
  let cursor = startOfDay(today);
  for (let guard = 0; guard < 5000 && rows.length < limit; guard += 1) {
    const key = toDateKey(cursor);
    if (key < habit.startDate) {
      break;
    }
    if (isScheduled(habit, cursor) && (habit.active || key < toDateKey(today))) {
      rows.push({
        date: key,
        label: formatMediumDate(cursor),
        completed: done.has(`${habit.id}|${key}`),
      });
    }
    cursor = addDays(cursor, -1);
  }
  return rows;
}
