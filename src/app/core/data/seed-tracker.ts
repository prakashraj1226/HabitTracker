import { inject } from '@angular/core';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { AppMeta } from '../models/settings.model';
import { AchievementService } from '../services/achievement.service';
import { EntryService } from '../services/entry.service';
import { GoalService } from '../services/goal.service';
import { HabitCompletionService } from '../services/habit-completion.service';
import { HabitService } from '../services/habit.service';
import { ReminderService } from '../services/reminder.service';
import { StorageService } from '../services/storage.service';
import { buildSeedData } from './seed-data';

export function prepareTracker(): Promise<void> {
  const storage = inject(StorageService);
  const habits = inject(HabitService);
  const completions = inject(HabitCompletionService);
  const entries = inject(EntryService);
  const goals = inject(GoalService);
  const achievements = inject(AchievementService);
  const reminders = inject(ReminderService);
  return storage.load().then(async (loaded) => {
    achievements.reload();
    goals.reload();
    entries.reload();
    completions.reload();
    habits.reload();
    if (loaded) {
      seedTrackerData(storage, habits, completions);
    }
    await reminders.refresh();
  });
}

function seedTrackerData(storage: StorageService, habits: HabitService, completions: HabitCompletionService): void {
  const meta = storage.get<AppMeta>(STORAGE_KEYS.meta);
  if (meta?.seeded) {
    return;
  }
  if (!habits.getAll().length && !completions.getAll().length) {
    const seed = buildSeedData(new Date());
    completions.replaceAll(seed.completions);
    habits.replaceAll(seed.habits);
  }
  storage.set(STORAGE_KEYS.meta, { seeded: true });
}
