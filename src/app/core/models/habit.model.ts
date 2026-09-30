export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM';

export interface Habit {
  id: number;
  name: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  startDate: string;
  reminderTime?: string;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  daysOfWeek?: number[];
}

export interface HabitDraft {
  name: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  startDate: string;
  reminderTime?: string;
  color?: string;
  icon?: string;
  active: boolean;
  daysOfWeek?: number[];
}
