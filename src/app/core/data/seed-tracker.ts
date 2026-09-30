import { inject } from '@angular/core';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { AppMeta } from '../models/settings.model';
import { HabitCompletionService } from '../services/habit-completion.service';
import { HabitService } from '../services/habit.service';
import { StorageService } from '../services/storage.service';
import { buildSeedData } from './seed-data';

export function prepareTracker(): Promise<void> {
  const storage = inject(StorageService);
  const habits = inject(HabitService);
  const completions = inject(HabitCompletionService);
  return storage.load().then((loaded) => {
    habits.reload();
    completions.reload();
    if (loaded) {
      seedTrackerData(storage, habits, completions);
    }
  });
}

export function seedTrackerData(
  storage: StorageService,
  habits: HabitService,
  completions: HabitCompletionService,
): void {
  let meta: AppMeta | null = null;
  try {
    meta = storage.get<AppMeta>(STORAGE_KEYS.meta);
  } catch {
    return;
  }
  if (meta?.seeded) {
    return;
  }
  if (habits.getAll().length || completions.getAll().length) {
    storage.set(STORAGE_KEYS.meta, { seeded: true });
    return;
  }
  const seed = buildSeedData(new Date());
  habits.replaceAll(seed.habits);
  completions.replaceAll(seed.completions);
  storage.set(STORAGE_KEYS.meta, { seeded: true });
}
