export interface HabitCompletion {
  id: number;
  habitId: number;
  date: string;
  completed: boolean;
  completedAt?: string;
}
