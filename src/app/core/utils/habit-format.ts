import { Habit } from '../models/habit.model';
import { HabitSummary } from '../models/progress.model';
import { isValidDateKey, parseDateKey, toDateKey } from './date.util';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function frequencyLabel(habit: Habit): string {
  if (habit.frequency === 'DAILY') {
    return 'Daily';
  }
  if (habit.frequency === 'WEEKLY') {
    if (!isValidDateKey(habit.startDate)) {
      return 'Weekly';
    }
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(parseDateKey(habit.startDate));
    return `Weekly · ${day}`;
  }
  const days = [...(habit.daysOfWeek ?? [])].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  if (!days.length) {
    return 'Custom';
  }
  return `Custom · ${days.map((day) => DAY_NAMES[day]).join(', ')}`;
}

export function streakLabel(count: number, unit: 'day' | 'week'): string {
  const word = unit === 'week' ? 'week' : 'day';
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function habitStatus(summary: HabitSummary, today = new Date()): string {
  if (!summary.habit.active) {
    return 'Inactive';
  }
  if (summary.habit.startDate > toDateKey(today)) {
    return 'Scheduled';
  }
  if (summary.dueToday && summary.completedToday) {
    return 'Completed';
  }
  if (summary.dueToday) {
    return 'Pending';
  }
  return 'Active';
}

export function statusBadge(status: string): string {
  if (status === 'Completed') {
    return 'badge badge--good';
  }
  if (status === 'Pending') {
    return 'badge badge--warn';
  }
  if (status === 'Inactive') {
    return 'badge badge--bad';
  }
  return 'badge';
}

export function readNotice(): string | null {
  const state = history.state as { notice?: unknown } | null;
  const notice = typeof state?.notice === 'string' ? state.notice : null;
  if (notice && state) {
    const rest = { ...state };
    delete rest.notice;
    history.replaceState(rest, '');
  }
  return notice;
}
