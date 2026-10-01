import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, combineLatest, debounceTime } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { UnlockedAchievement } from '../models/goal.model';
import { ACHIEVEMENTS, AchievementDef, earnedAchievements, indexCompletions } from '../utils/stats.util';
import { HabitCompletionService } from './habit-completion.service';
import { HabitService } from './habit.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AchievementService {
  private readonly storage = inject(StorageService);
  private readonly subject = new BehaviorSubject<UnlockedAchievement[]>(this.read());
  private readonly unlockedSubject = new Subject<AchievementDef>();
  private ready = false;
  private started = false;

  readonly unlocked$ = this.subject.asObservable();
  readonly newlyUnlocked$ = this.unlockedSubject.asObservable();

  constructor() {
    const habits = inject(HabitService);
    const completions = inject(HabitCompletionService);
    combineLatest([habits.habits$, completions.completions$])
      .pipe(debounceTime(150), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(([habitList, completionList]) => {
        this.check(earnedAchievements(habitList, indexCompletions(completionList)));
      });
  }

  reload(): void {
    this.subject.next(this.read());
    this.ready = true;
    this.started = false;
  }

  private check(earned: Set<string>): void {
    if (!this.ready) {
      return;
    }
    const known = new Set(this.subject.value.map((item) => item.id));
    const fresh = ACHIEVEMENTS.filter((def) => earned.has(def.id) && !known.has(def.id));
    const announce = this.started;
    this.started = true;
    if (!fresh.length) {
      return;
    }
    const now = new Date().toISOString();
    const next = [...this.subject.value, ...fresh.map((def) => ({ id: def.id, unlockedAt: now }))];
    this.storage.set(STORAGE_KEYS.achievements, next);
    this.subject.next(next);
    if (announce) {
      fresh.forEach((def) => this.unlockedSubject.next(def));
    }
  }

  private read(): UnlockedAchievement[] {
    const value = this.storage.get<UnlockedAchievement[]>(STORAGE_KEYS.achievements);
    return Array.isArray(value) ? value.filter((item) => typeof item?.id === 'string') : [];
  }
}
