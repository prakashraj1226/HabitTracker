import { HabitCompletion } from '../models/habit-completion.model';
import { Habit, HabitKind, HabitRepeat } from '../models/habit.model';
import { addDays, parseDateKey, startOfDay, toDateKey } from './date.util';

export function habitKind(habit: Habit): HabitKind {
  return habit.kind === 'measurable' ? 'measurable' : 'tick';
}

export function habitRepeat(habit: Habit): HabitRepeat {
  if (habit.repeat) {
    return habit.repeat;
  }
  return habit.frequency === 'WEEKLY' ? 'weekly' : 'once';
}

export function habitColor(habit: Habit): string {
  return habit.color || '#3DDC97';
}

export function findCompletion(completions: HabitCompletion[], habitId: number, date: string): HabitCompletion | undefined {
  return completions.find((item) => item.habitId === habitId && item.date === date);
}

export function amountOf(completion: HabitCompletion | undefined): number {
  if (!completion) {
    return 0;
  }
  if (typeof completion.value === 'number') {
    return completion.value;
  }
  return completion.completed ? 1 : 0;
}

export function isDone(completion: HabitCompletion | undefined): boolean {
  return amountOf(completion) > 0;
}

export function streakCount(habitId: number, completions: HabitCompletion[], today = new Date()): number {
  let cursor = startOfDay(today);
  if (!isDone(findCompletion(completions, habitId, toDateKey(cursor)))) {
    cursor = addDays(cursor, -1);
  }
  let count = 0;
  for (let index = 0; index < 365; index += 1) {
    if (!isDone(findCompletion(completions, habitId, toDateKey(cursor)))) {
      break;
    }
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function weekProgress(habitId: number, completions: HabitCompletion[], week: Date[]): { done: number; total: number } {
  const done = week.filter((date) => isDone(findCompletion(completions, habitId, toDateKey(date)))).length;
  return { done, total: week.length };
}

export function weekAmount(habitId: number, completions: HabitCompletion[], week: Date[]): number {
  return week.reduce((sum, date) => sum + amountOf(findCompletion(completions, habitId, toDateKey(date))), 0);
}

export function scheduledOn(habit: Habit, date: Date): boolean {
  if (!habit.daysOfWeek?.length || habit.frequency !== 'CUSTOM') {
    return true;
  }
  return habit.daysOfWeek.includes(date.getDay());
}

export function heatmapWeeks(today: Date, weeks = 18): Date[][] {
  const end = startOfDay(today);
  const mondayOffset = (end.getDay() + 6) % 7;
  const start = addDays(end, -mondayOffset - ((weeks - 1) * 7));
  const columns: Date[][] = [];
  for (let week = 0; week < weeks; week += 1) {
    const column: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      column.push(addDays(start, week * 7 + day));
    }
    columns.push(column);
  }
  return columns;
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

export function shortMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function parseTime(value: string): { hour: number; minute: number; meridiem: 'AM' | 'PM' } {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  const hour24 = Number.isFinite(rawHour) ? rawHour : 9;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return { hour, minute, meridiem };
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
