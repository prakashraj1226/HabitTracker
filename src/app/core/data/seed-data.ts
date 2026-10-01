import { Habit } from '../models/habit.model';
import { HabitCompletion } from '../models/habit-completion.model';
import { addDays, parseDateKey, startOfDay, toDateKey } from '../utils/date.util';
import { isScheduledOn } from '../utils/stats.util';

export function buildSeedData(today: Date): { habits: Habit[]; completions: HabitCompletion[] } {
  const end = startOfDay(today);
  const created = addDays(end, -28).toISOString();
  const base = (id: number, daysAgo: number, fields: Partial<Habit>): Habit => ({
    id,
    name: '',
    category: 'Health',
    frequency: 'DAILY',
    startDate: toDateKey(addDays(end, -daysAgo)),
    active: true,
    createdAt: created,
    updatedAt: created,
    kind: 'tick',
    intent: 'build',
    target: 1,
    reminders: [],
    ...fields,
  });
  const habits: Habit[] = [
    base(1, 21, { name: 'Morning run', description: 'Run for at least 20 minutes.', category: 'Fitness', icon: 'run', color: '#7eb6ff',
      reminders: [{ id: 1, time: '06:30', enabled: true, message: 'Shoes on, out the door!', repeat: 'daily' }] }),
    base(2, 18, { name: 'Read', description: 'Read without switching tasks.', category: 'Learning', icon: 'book', color: '#9b8cff',
      kind: 'measurable', unit: 'pages', target: 20 }),
    base(3, 14, { name: 'Drink water', category: 'Health', icon: 'droplet', color: '#5eead4', kind: 'measurable', unit: 'glasses', target: 8 }),
    base(4, 28, { name: 'Gym', category: 'Fitness', icon: 'gym', color: '#f6ad7b', frequency: 'WEEKLY', timesPerWeek: 3 }),
    base(5, 20, { name: 'Meditation', description: 'Ten quiet minutes.', category: 'Personal', icon: 'sun', color: '#c084fc',
      frequency: 'CUSTOM', daysOfWeek: [1, 2, 3, 4, 5] }),
    base(6, 60, { name: 'Pay bills', category: 'Finances', icon: 'target', color: '#f28b82', frequency: 'MONTHLY', dayOfMonth: 1 }),
  ];

  const completions: HabitCompletion[] = [];
  let completionId = 1;
  for (const habit of habits) {
    for (let day = parseDateKey(habit.startDate); day <= end; day = addDays(day, 1)) {
      const value = seedValue(habit, day, end);
      if (value > 0 && (isScheduledOn(habit, day) || habit.frequency === 'WEEKLY')) {
        completions.push({
          id: completionId++,
          habitId: habit.id,
          date: toDateKey(day),
          completed: true,
          value,
          completedAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, 0, 0).toISOString(),
        });
      }
    }
  }
  return { habits, completions };
}

function seedValue(habit: Habit, date: Date, today: Date): number {
  const isToday = toDateKey(date) === toDateKey(today);
  const dayOfMonth = date.getDate();
  switch (habit.id) {
    case 1:
      return !isToday && date.getDay() !== 0 ? 1 : 0;
    case 2:
      return isToday ? 12 : dayOfMonth % 5 === 0 ? 0 : 20 + (dayOfMonth % 3) * 5;
    case 3:
      return isToday ? 5 : 6 + (dayOfMonth % 4);
    case 4:
      return [1, 3, 5].includes(date.getDay()) && !isToday ? 1 : 0;
    case 5:
      return isToday ? 0 : 1;
    case 6:
      return 1;
    default:
      return 0;
  }
}
