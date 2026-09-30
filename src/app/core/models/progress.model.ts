import { Habit } from './habit.model';

export interface HabitSummary {
  habit: Habit;
  currentStreak: number;
  longestStreak: number;
  streakUnit: 'day' | 'week';
  completionPercentage: number;
  completedCount: number;
  scheduledCount: number;
  dueToday: boolean;
  completedToday: boolean;
}

export interface ProgressRatio {
  completed: number;
  total: number;
  percentage: number;
}

export interface StreakSnapshot {
  current: number;
  longest: number;
}

export type DayState = 'future' | 'off' | 'miss' | 'partial' | 'complete';

export interface DayBar {
  date: string;
  label: string;
  percentage: number;
  visual: number;
  completed: number;
  total: number;
  state: DayState;
}

export interface CalendarCell {
  key: string;
  date: string | null;
  label: string;
  state: 'pad' | DayState;
  title: string;
}

export interface DayDetail {
  date: string;
  total: number;
  completedCount: number;
  percentage: number | null;
  timing: 'future' | 'today' | 'past';
  completed: Habit[];
  open: Habit[];
}

export interface HistoryEntry {
  date: string;
  label: string;
  completed: boolean;
}
