import { Habit } from '../models/habit.model';
import { HabitCompletion } from '../models/habit-completion.model';
import { addDays, parseDateKey, startOfDay, toDateKey } from '../utils/date.util';
import { isScheduled } from '../utils/progress.util';

export function buildSeedData(today: Date): { habits: Habit[]; completions: HabitCompletion[] } {
  const created = addDays(startOfDay(today), -28).toISOString();
  const habits: Habit[] = [
    habit(1, 'Morning run', 'Run for at least 20 minutes.', 'Fitness', 'DAILY', 21, '06:30', '#1f5fbf', 'activity', true, created, today),
    habit(2, 'Read 20 pages', 'Read without switching tasks.', 'Learning', 'DAILY', 18, '21:00', '#0f766e', 'book', true, created, today),
    habit(3, 'Drink water', 'Finish eight glasses through the day.', 'Health', 'DAILY', 14, '09:00', '#0369a1', 'droplet', true, created, today),
    habit(4, 'Weekly review', 'Review the week and set the next priorities.', 'Productivity', 'WEEKLY', 28, '17:30', '#b45309', 'target', true, created, today),
    habit(5, 'Meditation', 'Sit for ten quiet minutes.', 'Mindfulness', 'CUSTOM', 20, '07:15', '#3730a3', 'sun', true, created, today, [1, 2, 3, 4, 5]),
    habit(6, 'Evening stretch', 'Ten minutes of mobility before bed.', 'Health', 'DAILY', 16, '21:30', '#334155', 'heart', false, created, today),
  ];

  const completions: HabitCompletion[] = [];
  let completionId = 1;
  for (const item of habits) {
    let cursor = parseDateKey(item.startDate);
    const end = startOfDay(today);
    while (toDateKey(cursor) <= toDateKey(end)) {
      if (isScheduled(item, cursor) && shouldComplete(item.id, cursor, today)) {
        completions.push({
          id: completionId,
          habitId: item.id,
          date: toDateKey(cursor),
          completed: true,
          completedAt: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 8, 0, 0).toISOString(),
        });
        completionId += 1;
      }
      cursor = addDays(cursor, 1);
    }
  }
  return { habits, completions };
}

function habit(
  id: number,
  name: string,
  description: string,
  category: string,
  frequency: Habit['frequency'],
  daysAgo: number,
  reminderTime: string,
  color: string,
  icon: string,
  active: boolean,
  createdAt: string,
  today: Date,
  daysOfWeek?: number[],
): Habit {
  return {
    id,
    name,
    description,
    category,
    frequency,
    startDate: toDateKey(addDays(today, -daysAgo)),
    reminderTime,
    color,
    icon,
    active,
    createdAt,
    updatedAt: createdAt,
    daysOfWeek,
  };
}

function shouldComplete(habitId: number, date: Date, today: Date): boolean {
  const key = toDateKey(date);
  const todayKey = toDateKey(today);
  if (key === todayKey) {
    return habitId === 2 || habitId === 3;
  }
  const dayOfMonth = date.getDate();
  switch (habitId) {
    case 1:
      return date.getDay() !== 0;
    case 2:
      return dayOfMonth % 5 !== 0;
    case 3:
    case 4:
    case 5:
      return true;
    case 6:
      return dayOfMonth % 2 === 0;
    default:
      return false;
  }
}
