import { HabitFrequency } from '../models/habit.model';

export const STORAGE_KEYS = {
  habits: 'habit-tracker.habits',
  completions: 'habit-tracker.completions',
  meta: 'habit-tracker.meta',
  settings: 'habit-tracker.settings',
  entries: 'habit-tracker.entries',
} as const;

export const HABIT_CATEGORIES = [
  'Health',
  'Fitness',
  'Mindfulness',
  'Learning',
  'Productivity',
  'Nutrition',
  'Sleep',
  'Personal',
] as const;

export const HABIT_FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const HABIT_COLORS = [
  { id: 'blue', value: '#1f5fbf', label: 'Blue' },
  { id: 'teal', value: '#0f766e', label: 'Teal' },
  { id: 'sky', value: '#0369a1', label: 'Sky' },
  { id: 'olive', value: '#3f6212', label: 'Olive' },
  { id: 'amber', value: '#b45309', label: 'Amber' },
  { id: 'red', value: '#b42318', label: 'Red' },
  { id: 'slate', value: '#334155', label: 'Slate' },
  { id: 'indigo', value: '#3730a3', label: 'Indigo' },
] as const;

export const HABIT_ICONS = [
  { id: 'activity', label: 'Activity' },
  { id: 'book', label: 'Reading' },
  { id: 'droplet', label: 'Water' },
  { id: 'sun', label: 'Morning' },
  { id: 'moon', label: 'Sleep' },
  { id: 'heart', label: 'Health' },
  { id: 'coffee', label: 'Routine' },
  { id: 'target', label: 'Focus' },
  { id: 'gym', label: 'Gym' },
] as const;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

export const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].value;
export const DEFAULT_HABIT_ICON = HABIT_ICONS[0].id;
