import { Goal } from '../models/goal.model';
import { HabitCompletion } from '../models/habit-completion.model';
import { Habit } from '../models/habit.model';
import { addDays, endOfMonth, parseDateKey, startOfDay, startOfMonth, startOfWeek, toDateKey, weekDates } from './date.util';

export type CompletionIndex = Map<string, HabitCompletion>;
export type DayState = 'done' | 'partial' | 'missed' | 'open' | 'off' | 'future';
export type Period = 'week' | 'month' | 'year';

export interface Tally {
  done: number;
  due: number;
}

export interface HabitStats {
  current: number;
  best: number;
  total: number;
  missed: number;
  rate: number;
  unit: 'day' | 'week';
}

export interface DayHabit {
  habit: Habit;
  state: DayState;
  amount: number;
}

export interface Bar {
  label: string;
  done: number;
  due: number;
  percent: number | null;
  current: boolean;
}

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-habit', icon: '🌱', title: 'First Habit', description: 'Create your first habit.' },
  { id: 'first-tick', icon: '✅', title: 'First Tick', description: 'Complete a habit for the first time.' },
  { id: 'streak-7', icon: '🔥', title: '7 Day Streak', description: 'Keep one habit going for 7 scheduled days in a row.' },
  { id: 'streak-30', icon: '🏅', title: '30 Day Streak', description: 'Keep one habit going for 30 scheduled days in a row.' },
  { id: 'completions-100', icon: '💯', title: '100 Completions', description: 'Complete habits 100 times in total.' },
  { id: 'perfect-week', icon: '🌟', title: 'Perfect Week', description: 'Finish every due habit from Monday to Sunday.' },
  { id: 'perfect-month', icon: '👑', title: 'Perfect Month', description: 'Finish every due habit for a whole calendar month.' },
];

export function indexCompletions(list: HabitCompletion[]): CompletionIndex {
  const index: CompletionIndex = new Map();
  for (const item of list) {
    index.set(`${item.habitId}|${item.date}`, item);
  }
  return index;
}

export function completionOf(index: CompletionIndex, habitId: number, key: string): HabitCompletion | undefined {
  return index.get(`${habitId}|${key}`);
}

export function dailyTarget(habit: Habit): number {
  return Math.max(1, habit.target ?? 1);
}

export function weeklyTarget(habit: Habit): number {
  return Math.min(7, Math.max(1, habit.timesPerWeek ?? 1));
}

export function isFlexible(habit: Habit): boolean {
  return habit.frequency === 'WEEKLY';
}

export function amountOn(habit: Habit, index: CompletionIndex, key: string): number {
  const completion = completionOf(index, habit.id, key);
  if (!completion) {
    return 0;
  }
  if (typeof completion.value === 'number') {
    return completion.value;
  }
  return completion.completed ? dailyTarget(habit) : 0;
}

export function isDoneOn(habit: Habit, index: CompletionIndex, key: string): boolean {
  return amountOn(habit, index, key) >= dailyTarget(habit);
}

export function isScheduledOn(habit: Habit, date: Date): boolean {
  if (habit.frequency === 'CUSTOM') {
    return !habit.daysOfWeek?.length || habit.daysOfWeek.includes(date.getDay());
  }
  if (habit.frequency === 'MONTHLY') {
    const lastDay = endOfMonth(date).getDate();
    return date.getDate() === Math.min(habit.dayOfMonth ?? 1, lastDay);
  }
  return true;
}

export function dayState(habit: Habit, index: CompletionIndex, date: Date, today: Date): DayState {
  const key = toDateKey(date);
  const todayKey = toDateKey(today);
  if (key > todayKey) {
    return 'future';
  }
  if (isDoneOn(habit, index, key)) {
    return 'done';
  }
  if (key < habit.startDate) {
    return 'off';
  }
  const isToday = key === todayKey;
  const started = amountOn(habit, index, key) > 0;
  if (isFlexible(habit)) {
    return isToday ? 'open' : started ? 'partial' : 'off';
  }
  if (!isScheduledOn(habit, date)) {
    return 'off';
  }
  if (isToday) {
    return 'open';
  }
  return started ? 'partial' : 'missed';
}

export function doneDaysBetween(habit: Habit, index: CompletionIndex, from: Date, to: Date): number {
  let count = 0;
  for (let day = startOfDay(from); day <= to; day = addDays(day, 1)) {
    if (isDoneOn(habit, index, toDateKey(day))) {
      count += 1;
    }
  }
  return count;
}

export function habitStats(habit: Habit, index: CompletionIndex, today = new Date()): HabitStats {
  const end = startOfDay(today);
  const todayKey = toDateKey(end);
  const start = parseDateKey(habit.startDate);
  const unit = isFlexible(habit) ? 'week' : 'day';
  let run = 0;
  let best = 0;
  let total = 0;
  let missed = 0;
  let hit = 0;
  let due = 0;
  if (start <= end && isFlexible(habit)) {
    const target = weeklyTarget(habit);
    for (let week = startOfWeek(start); week <= end; week = addDays(week, 7)) {
      const from = week < start ? start : week;
      const sunday = addDays(week, 6);
      const count = doneDaysBetween(habit, index, from, sunday < end ? sunday : end);
      total += count;
      if (count >= target) {
        run += 1;
        hit += 1;
        due += 1;
        best = Math.max(best, run);
      } else if (sunday < end) {
        run = 0;
        missed += 1;
        due += 1;
      }
    }
  } else if (start <= end) {
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const key = toDateKey(day);
      const done = isDoneOn(habit, index, key);
      if (done) {
        total += 1;
      }
      if (!isScheduledOn(habit, day)) {
        continue;
      }
      if (done) {
        run += 1;
        hit += 1;
        due += 1;
        best = Math.max(best, run);
      } else if (key !== todayKey) {
        run = 0;
        missed += 1;
        due += 1;
      }
    }
  }
  return { current: run, best, total, missed, rate: due ? Math.round((hit / due) * 100) : 0, unit };
}

export function rangeTally(habit: Habit, index: CompletionIndex, from: Date, to: Date, today = new Date()): Tally {
  const todayStart = startOfDay(today);
  const startDate = parseDateKey(habit.startDate);
  const begin = startOfDay(from) < startDate ? startDate : startOfDay(from);
  const end = startOfDay(to) < todayStart ? startOfDay(to) : todayStart;
  const tally: Tally = { done: 0, due: 0 };
  if (begin > end) {
    return tally;
  }
  if (isFlexible(habit)) {
    const target = weeklyTarget(habit);
    for (let week = startOfWeek(begin); week <= end; week = addDays(week, 7)) {
      let overlap = 0;
      let count = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const day = addDays(week, offset);
        if (day < begin || day > end) {
          continue;
        }
        overlap += 1;
        if (isDoneOn(habit, index, toDateKey(day))) {
          count += 1;
        }
      }
      const need = Math.max(1, Math.round((target * overlap) / 7));
      tally.done += Math.min(count, need);
      tally.due += need;
    }
    return tally;
  }
  const todayKey = toDateKey(todayStart);
  for (let day = begin; day <= end; day = addDays(day, 1)) {
    if (!isScheduledOn(habit, day)) {
      continue;
    }
    const key = toDateKey(day);
    if (isDoneOn(habit, index, key)) {
      tally.done += 1;
      tally.due += 1;
    } else if (key !== todayKey) {
      tally.due += 1;
    }
  }
  return tally;
}

export function sumTally(list: Tally[]): Tally {
  return list.reduce((sum, item) => ({ done: sum.done + item.done, due: sum.due + item.due }), { done: 0, due: 0 });
}

export function percentOf(tally: Tally): number | null {
  return tally.due ? Math.round((tally.done / tally.due) * 100) : null;
}

export function habitsForDay(habits: Habit[], index: CompletionIndex, date: Date, today = new Date()): DayHabit[] {
  const key = toDateKey(date);
  const todayKey = toDateKey(today);
  const result: DayHabit[] = [];
  for (const habit of habits) {
    if (!habit.active || key < habit.startDate) {
      continue;
    }
    const state = dayState(habit, index, date, today);
    const amount = amountOn(habit, index, key);
    if (isFlexible(habit)) {
      if (state === 'done' || amount > 0) {
        result.push({ habit, state, amount });
      } else if (key === todayKey) {
        const weekStart = startOfWeek(date);
        const before = weekStart < date ? doneDaysBetween(habit, index, weekStart, addDays(date, -1)) : 0;
        if (before < weeklyTarget(habit)) {
          result.push({ habit, state, amount });
        }
      }
      continue;
    }
    if (isScheduledOn(habit, date) || state === 'done') {
      result.push({ habit, state, amount });
    }
  }
  return result;
}

export function dayTally(habits: Habit[], index: CompletionIndex, date: Date, today = new Date()): Tally {
  const items = habitsForDay(habits, index, date, today).filter((item) => item.state !== 'future' && item.state !== 'off');
  return { done: items.filter((item) => item.state === 'done').length, due: items.length };
}

export function dayProgress(items: DayHabit[]): number {
  if (!items.length) {
    return 0;
  }
  const sum = items.reduce((total, item) => total + Math.min(1, item.amount / dailyTarget(item.habit)), 0);
  return Math.round((sum / items.length) * 100);
}

export function perfectDayStreaks(habits: Habit[], index: CompletionIndex, today = new Date()): { current: number; best: number } {
  const active = habits.filter((habit) => habit.active);
  if (!active.length) {
    return { current: 0, best: 0 };
  }
  const end = startOfDay(today);
  const todayKey = toDateKey(end);
  const earliest = active.map((habit) => habit.startDate).sort()[0];
  const floor = addDays(end, -730);
  let day = parseDateKey(earliest) < floor ? floor : parseDateKey(earliest);
  let run = 0;
  let best = 0;
  for (; day <= end; day = addDays(day, 1)) {
    const tally = dayTally(active, index, day, end);
    if (tally.due === 0 || (toDateKey(day) === todayKey && tally.done < tally.due)) {
      continue;
    }
    if (tally.done === tally.due) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { current: run, best };
}

export function periodRange(period: Period, today = new Date()): { from: Date; to: Date } {
  const end = startOfDay(today);
  if (period === 'week') {
    return { from: startOfWeek(end), to: addDays(startOfWeek(end), 6) };
  }
  if (period === 'month') {
    return { from: startOfMonth(end), to: endOfMonth(end) };
  }
  return { from: new Date(end.getFullYear(), 0, 1), to: new Date(end.getFullYear(), 11, 31) };
}

export function periodTally(habits: Habit[], index: CompletionIndex, period: Period, today = new Date()): Tally {
  const { from, to } = periodRange(period, today);
  return sumTally(habits.filter((habit) => habit.active).map((habit) => rangeTally(habit, index, from, to, today)));
}

export function periodBars(habits: Habit[], index: CompletionIndex, period: Period, today = new Date()): Bar[] {
  const end = startOfDay(today);
  const active = habits.filter((habit) => habit.active);
  const toBar = (label: string, tally: Tally | null, current: boolean): Bar => ({
    label,
    done: tally?.done ?? 0,
    due: tally?.due ?? 0,
    percent: tally ? percentOf(tally) : null,
    current,
  });
  if (period === 'week') {
    return weekDates(end).map((date) => toBar(
      date.toLocaleDateString('en-GB', { weekday: 'short' }),
      date > end ? null : dayTally(active, index, date, end),
      toDateKey(date) === toDateKey(end),
    ));
  }
  if (period === 'month') {
    const first = startOfMonth(end);
    const last = endOfMonth(end);
    const bars: Bar[] = [];
    for (let from = first; from <= last;) {
      const sunday = addDays(startOfWeek(from), 6);
      const to = sunday < last ? sunday : last;
      bars.push(toBar(
        `${from.getDate()}–${to.getDate()}`,
        from > end ? null : sumTally(active.map((habit) => rangeTally(habit, index, from, to, end))),
        from <= end && end <= to,
      ));
      from = addDays(to, 1);
    }
    return bars;
  }
  return Array.from({ length: 12 }, (_, month) => {
    const from = new Date(end.getFullYear(), month, 1);
    const to = endOfMonth(from);
    return toBar(
      from.toLocaleDateString('en-GB', { month: 'short' }),
      from > end ? null : sumTally(active.map((habit) => rangeTally(habit, index, from, to, end))),
      month === end.getMonth(),
    );
  });
}

export function goalProgress(goal: Goal, habit: Habit, index: CompletionIndex, today = new Date()): { done: number; target: number; percent: number } {
  const { from, to } = periodRange(goal.period, today);
  const end = startOfDay(today);
  const done = doneDaysBetween(habit, index, from, to < end ? to : end);
  return { done, target: goal.target, percent: Math.min(100, Math.round((done / goal.target) * 100)) };
}

export function earnedAchievements(habits: Habit[], index: CompletionIndex, today = new Date()): Set<string> {
  const earned = new Set<string>();
  if (habits.length) {
    earned.add('first-habit');
  }
  const stats = habits.map((habit) => ({ habit, stats: habitStats(habit, index, today) }));
  const total = stats.reduce((sum, item) => sum + item.stats.total, 0);
  const bestDays = Math.max(0, ...stats.filter((item) => item.stats.unit === 'day').map((item) => item.stats.best));
  if (total >= 1) {
    earned.add('first-tick');
  }
  if (total >= 100) {
    earned.add('completions-100');
  }
  if (bestDays >= 7) {
    earned.add('streak-7');
  }
  if (bestDays >= 30) {
    earned.add('streak-30');
  }
  const end = startOfDay(today);
  const active = habits.filter((habit) => habit.active);
  for (let weeks = 0; weeks < 26 && active.length; weeks += 1) {
    const monday = addDays(startOfWeek(end), -7 * weeks);
    if (isPerfectRange(active, index, monday, addDays(monday, 6), end, true)) {
      earned.add('perfect-week');
      break;
    }
  }
  for (let months = 0; months < 12 && active.length; months += 1) {
    const first = new Date(end.getFullYear(), end.getMonth() - months, 1);
    if (isPerfectRange(active, index, first, endOfMonth(first), end, false)) {
      earned.add('perfect-month');
      break;
    }
  }
  return earned;
}

function isPerfectRange(habits: Habit[], index: CompletionIndex, from: Date, to: Date, today: Date, checkWeekly: boolean): boolean {
  if (to > today) {
    return false;
  }
  let due = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const tally = dayTally(habits, index, day, today);
    if (tally.done < tally.due) {
      return false;
    }
    due += tally.due;
  }
  if (checkWeekly) {
    for (const habit of habits.filter((item) => isFlexible(item) && item.startDate <= toDateKey(from))) {
      if (doneDaysBetween(habit, index, from, to) < weeklyTarget(habit)) {
        return false;
      }
    }
  }
  return due > 0;
}
