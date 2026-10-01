import { HabitFrequency } from '../models/habit.model';

export const STORAGE_KEYS = {
  habits: 'habit-tracker.habits',
  completions: 'habit-tracker.completions',
  meta: 'habit-tracker.meta',
  settings: 'habit-tracker.settings',
  entries: 'habit-tracker.entries',
  goals: 'habit-tracker.goals',
  achievements: 'habit-tracker.achievements',
} as const;

export const HABIT_CATEGORIES = [
  'Health', 'Fitness', 'Learning', 'Personal', 'Nutrition', 'Finances',
  'Social', 'Study', 'Work', 'Art', 'Morning', 'Evening', 'Other',
];

export const HABIT_ICONS = ['heart', 'book', 'gym', 'run', 'food', 'music', 'droplet', 'star', 'sun', 'moon', 'coffee', 'target', 'activity'];

export const HABIT_COLORS = ['#f28b82', '#f6ad7b', '#7eb6ff', '#9b8cff', '#c084fc', '#3ddc97', '#5eead4', '#f0a48a'];

export const FREQUENCY_OPTIONS: { value: HabitFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'CUSTOM', label: 'Specific days' },
  { value: 'WEEKLY', label: 'Times per week' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export const DEFAULT_COLOR = '#3ddc97';
