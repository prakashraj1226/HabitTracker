import { DEFAULT_COLOR, WEEKDAY_OPTIONS } from '../constants/habit.constants';
import { Habit } from '../models/habit.model';
import { addDays, parseDateKey, startOfDay, toDateKey } from './date.util';

export function habitColor(habit: Habit): string {
  return habit.color || DEFAULT_COLOR;
}

export function frequencyLabel(habit: Habit): string {
  switch (habit.frequency) {
    case 'CUSTOM': {
      const days = habit.daysOfWeek ?? [];
      if (days.length === 7) {
        return 'Every day';
      }
      return WEEKDAY_OPTIONS.filter((option) => days.includes(option.value)).map((option) => option.label).join(', ');
    }
    case 'WEEKLY':
      return `${habit.timesPerWeek ?? 1}× per week`;
    case 'MONTHLY':
      return `Monthly on the ${ordinal(habit.dayOfMonth ?? 1)}`;
    default:
      return 'Every day';
  }
}

export function targetLabel(habit: Habit): string {
  const target = habit.target ?? 1;
  if (habit.kind === 'measurable') {
    return `${target} ${habit.unit ?? ''}`.trim();
  }
  return target > 1 ? `${target}× a day` : '';
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) {
    return 'Good night';
  }
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function heatmapWeeks(today: Date, weeks = 18): Date[][] {
  const end = startOfDay(today);
  const mondayOffset = (end.getDay() + 6) % 7;
  const start = addDays(end, -mondayOffset - ((weeks - 1) * 7));
  return Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (__, day) => addDays(start, week * 7 + day)));
}

export function monthCells(month: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

export function sameDay(left: Date, right: Date): boolean {
  return toDateKey(left) === toDateKey(right);
}

export function ordinal(day: number): string {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) {
    return `${day}th`;
  }
  const last = day % 10;
  if (last === 1) {
    return `${day}st`;
  }
  if (last === 2) {
    return `${day}nd`;
  }
  if (last === 3) {
    return `${day}rd`;
  }
  return `${day}th`;
}

export function todayLabel(date = new Date()): string {
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `Today, ${ordinal(date.getDate())} ${month}`;
}

export function shortDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function parseTime(value: string): { hour: number; minute: number; meridiem: 'AM' | 'PM' } {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  const hour24 = Number.isFinite(rawHour) ? rawHour : 9;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return { hour: hour24 % 12 || 12, minute, meridiem: hour24 >= 12 ? 'PM' : 'AM' };
}

export function toTimeValue(hour: number, minute: number, meridiem: 'AM' | 'PM'): string {
  let hour24 = hour % 12;
  if (meridiem === 'PM') {
    hour24 += 12;
  }
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatClock(value: string): string {
  const parsed = parseTime(value);
  return `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.meridiem}`;
}

export function dateFromKey(value: string): Date {
  return parseDateKey(value);
}
