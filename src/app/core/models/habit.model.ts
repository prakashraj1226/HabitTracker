export type HabitFrequency = 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY';
export type HabitKind = 'tick' | 'measurable';
export type HabitIntent = 'build' | 'quit';
export type ReminderRepeat = 'daily' | 'scheduled';

export interface HabitReminder {
  id: number;
  time: string;
  enabled: boolean;
  message: string;
  repeat: ReminderRepeat;
}

export interface Habit {
  id: number;
  name: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  startDate: string;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  daysOfWeek?: number[];
  timesPerWeek?: number;
  dayOfMonth?: number;
  kind?: HabitKind;
  intent?: HabitIntent;
  unit?: string;
  target?: number;
  reminders?: HabitReminder[];
  reminderTime?: string;
  reminderEnabled?: boolean;
  repeat?: 'once' | 'multiple' | 'weekly';
}

export type HabitDraft = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>;
