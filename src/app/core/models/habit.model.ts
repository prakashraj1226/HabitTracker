export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM';
export type HabitKind = 'tick' | 'measurable';
export type HabitIntent = 'build' | 'quit';
export type HabitRepeat = 'once' | 'multiple' | 'weekly';

export interface Habit {
  id: number;
  name: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  startDate: string;
  reminderTime?: string;
  reminderEnabled?: boolean;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  daysOfWeek?: number[];
  kind?: HabitKind;
  intent?: HabitIntent;
  repeat?: HabitRepeat;
  unit?: string;
  target?: number;
}

export interface HabitDraft {
  name: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  startDate: string;
  reminderTime?: string;
  reminderEnabled?: boolean;
  color?: string;
  icon?: string;
  active: boolean;
  daysOfWeek?: number[];
  kind?: HabitKind;
  intent?: HabitIntent;
  repeat?: HabitRepeat;
  unit?: string;
  target?: number;
}
