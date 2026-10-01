import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { Habit, HabitDraft, HabitFrequency, HabitKind, HabitRepeat } from '../models/habit.model';
import { isValidDateKey } from '../utils/date.util';
import { HabitCompletionService } from './habit-completion.service';
import { ReminderService } from './reminder.service';
import { StorageService } from './storage.service';

const FREQUENCIES: HabitFrequency[] = ['DAILY', 'WEEKLY', 'CUSTOM'];

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly storage = inject(StorageService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly reminders = inject(ReminderService);
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

  archive(id: number): void {
    this.setActive(id, false);
  }

  restore(id: number): void {
    this.setActive(id, true);
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
    if (category.length < 2 || category.length > 24) {
      throw new Error('Choose a category.');
    }
    if (!FREQUENCIES.includes(draft.frequency) && !draft.repeat) {
      throw new Error('Choose how often this habit repeats.');
    }
    if (!isValidDateKey(draft.startDate)) {
      throw new Error('Choose a valid start date.');
    }
    if (draft.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminderTime)) {
      throw new Error('Enter a valid reminder time.');
    }
    const days = [...new Set((draft.daysOfWeek ?? []).filter((day) => day >= 0 && day <= 6))];
    const repeat = draft.repeat ?? (draft.frequency === 'WEEKLY' ? 'weekly' : 'once');
    const frequency: HabitFrequency = repeat === 'weekly' ? 'WEEKLY' : draft.frequency === 'CUSTOM' && days.length ? 'CUSTOM' : 'DAILY';
    if (frequency === 'CUSTOM' && days.length === 0) {
      throw new Error('Choose at least one day for a custom habit.');
    }
    const kind: HabitKind = draft.kind === 'measurable' ? 'measurable' : 'tick';
    const reminderOn = Boolean(draft.reminderEnabled && draft.reminderTime);
    return {
      name,
      description: description || undefined,
      category,
      frequency,
      startDate: draft.startDate,
      reminderTime: reminderOn ? draft.reminderTime : undefined,
      reminderEnabled: reminderOn,
      color: draft.color,
      icon: draft.icon,
      active: draft.active,
      daysOfWeek: frequency === 'CUSTOM' ? days : undefined,
      kind,
      intent: draft.intent === 'quit' ? 'quit' : 'build',
      repeat,
      unit: kind === 'measurable' ? (draft.unit?.trim() || 'times').slice(0, 20) : undefined,
      target: clampTarget(draft.target, kind, repeat),
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
      return value
        .filter((habit) => typeof habit?.id === 'number' && typeof habit?.name === 'string')
        .map((habit) => migrateHabit(habit));
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
      void this.reminders.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Habits could not be saved.';
      this.errorSubject.next(message);
      throw new Error(message);
    }
  }

  private setActive(id: number, active: boolean): void {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('That habit could not be found.');
    }
    this.persist(this.subject.value.map((habit) => (
      habit.id === id ? { ...habit, active, updatedAt: new Date().toISOString() } : habit
    )));
  }

  private nextId(): number {
    this.sequence += 1;
    return Date.now() * 100 + (this.sequence % 100);
  }
}

function clampTarget(value: number | undefined, kind: HabitKind, repeat: HabitRepeat): number {
  const fallback = kind === 'measurable' ? 8 : repeat === 'multiple' ? 2 : 1;
  const parsed = Number.isFinite(value) ? Math.round(value as number) : fallback;
  return Math.min(99, Math.max(1, parsed));
}

function migrateHabit(habit: Habit): Habit {
  const repeat: HabitRepeat = habit.repeat ?? (habit.frequency === 'WEEKLY' ? 'weekly' : 'once');
  const kind: HabitKind = habit.kind === 'measurable' ? 'measurable' : 'tick';
  return {
    ...habit,
    kind,
    intent: habit.intent === 'quit' ? 'quit' : 'build',
    repeat,
    unit: kind === 'measurable' ? habit.unit || 'times' : undefined,
    target: clampTarget(habit.target, kind, repeat),
    reminderEnabled: habit.reminderEnabled ?? Boolean(habit.reminderTime),
    color: habit.color || '#3DDC97',
    icon: habit.icon || 'star',
    category: habit.category || 'Other',
    active: habit.active !== false,
  };
}
