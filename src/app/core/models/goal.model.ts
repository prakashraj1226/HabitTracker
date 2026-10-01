export type GoalPeriod = 'week' | 'month';

export interface Goal {
  id: number;
  habitId: number;
  target: number;
  period: GoalPeriod;
  createdAt: string;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}
