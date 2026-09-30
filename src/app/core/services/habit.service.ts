import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HABIT_CATEGORIES, STORAGE_KEYS } from '../constants/habit.constants';
import { Habit, HabitDraft, HabitFrequency } from '../models/habit.model';
import { isValidDateKey } from '../utils/date.util';
import { HabitCompletionService } from './habit-completion.service';
import { StorageService } from './storage.service';

const FREQUENCIES: HabitFrequency[] = ['DAILY', 'WEEKLY', 'CUSTOM'];

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly storage = inject(StorageService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly subject = new BehaviorSubject<Habit[]>(this.read());
  private sequence = 0;

  readonly error$ = this.errorSubject.asObservable();
  readonly habits$: Observable<Habit[]> = this.subject.asObservable();

  getAll(): Habit[] {
    return this.subject.value;
  }

  getById(id: number): Habit | undefined {
    return this.subject.value.find((habit) => habit.id === id);
  }

  create(draft: HabitDraft): Habit {
    const normalized = this.normalize(draft);
    const now = new Date().toISOString();
    const habit: Habit = {
      ...normalized,
      id: this.nextId(),
      createdAt: now,
      updatedAt: now,
    };
    this.persist([...this.subject.value, habit]);
    return habit;
  }

  update(id: number, draft: HabitDraft): Habit {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('That habit could not be found.');
    }
    const normalized = this.normalize(draft);
    const updated: Habit = {
      ...existing,
      ...normalized,
      updatedAt: new Date().toISOString(),
    };
    this.persist(this.subject.value.map((habit) => (habit.id === id ? updated : habit)));
    return updated;
  }

  delete(id: number): void {
    if (!this.getById(id)) {
      throw new Error('That habit could not be found.');
    }
    this.persist(this.subject.value.filter((habit) => habit.id !== id));
    this.completionService.removeByHabit(id);
  }

  replaceAll(habits: Habit[]): void {
    this.persist(habits);
  }

  reload(): void {
    this.subject.next(this.read());
  }

  private normalize(draft: HabitDraft): HabitDraft {
    const name = draft.name.trim();
    const description = draft.description?.trim() ?? '';
    const category = draft.category.trim();
    if (name.length < 2 || name.length > 60) {
      throw new Error('Enter a habit name between 2 and 60 characters.');
    }
    if (description.length > 240) {
      throw new Error('Keep the description under 240 characters.');
    }
    if (!HABIT_CATEGORIES.includes(category as (typeof HABIT_CATEGORIES)[number])) {
      throw new Error('Choose a category.');
    }
    if (!FREQUENCIES.includes(draft.frequency)) {
      throw new Error('Choose how often this habit repeats.');
    }
    if (!isValidDateKey(draft.startDate)) {
      throw new Error('Choose a valid start date.');
    }
    if (draft.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminderTime)) {
      throw new Error('Enter a valid reminder time.');
    }
    const days = [...new Set((draft.daysOfWeek ?? []).filter((day) => day >= 0 && day <= 6))];
    if (draft.frequency === 'CUSTOM' && days.length === 0) {
      throw new Error('Choose at least one day for a custom habit.');
    }
    return {
      name,
      description: description || undefined,
      category,
      frequency: draft.frequency,
      startDate: draft.startDate,
      reminderTime: draft.reminderTime || undefined,
      color: draft.color,
      icon: draft.icon,
      active: draft.active,
      daysOfWeek: draft.frequency === 'CUSTOM' ? days : undefined,
    };
  }

  private read(): Habit[] {
    try {
      const value = this.storage.get<Habit[]>(STORAGE_KEYS.habits);
      if (value === null) {
        return [];
      }
      if (!Array.isArray(value)) {
        this.errorSubject.next('Saved habits are in an unexpected format.');
        return [];
      }
      return value.filter((habit) => typeof habit?.id === 'number' && typeof habit?.name === 'string');
    } catch (error) {
      this.errorSubject.next(error instanceof Error ? error.message : 'Saved habits could not be read.');
      return [];
    }
  }

  private persist(habits: Habit[]): void {
    try {
      this.storage.set(STORAGE_KEYS.habits, habits);
      this.subject.next(habits);
      this.errorSubject.next(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Habits could not be saved.';
      this.errorSubject.next(message);
      throw new Error(message);
    }
  }

  private nextId(): number {
    this.sequence += 1;
    return Date.now() * 100 + (this.sequence % 100);
  }
}
