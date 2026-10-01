import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { HabitCompletion } from '../models/habit-completion.model';
import { Habit } from '../models/habit.model';
import { amountOn, dailyTarget, indexCompletions, isDoneOn } from '../utils/stats.util';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class HabitCompletionService {
  private readonly storage = inject(StorageService);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly subject = new BehaviorSubject<HabitCompletion[]>(this.read());
  private sequence = 0;

  readonly error$ = this.errorSubject.asObservable();
  readonly completions$: Observable<HabitCompletion[]> = this.subject.asObservable();

  getAll(): HabitCompletion[] {
    return this.subject.value;
  }

  find(habitId: number, date: string): HabitCompletion | undefined {
    return this.subject.value.find((item) => item.habitId === habitId && item.date === date);
  }

  setValue(habitId: number, date: string, value: number): void {
    const amount = Math.max(0, Math.min(9999, Math.round(value)));
    this.upsert(habitId, date, (current) => ({
      ...current,
      value: amount,
      completed: amount > 0,
      completedAt: amount > 0 ? current.completedAt ?? new Date().toISOString() : undefined,
    }));
  }

  toggleDone(habit: Habit, date: string): void {
    const index = indexCompletions(this.subject.value);
    this.setValue(habit.id, date, isDoneOn(habit, index, date) ? 0 : dailyTarget(habit));
  }

  step(habit: Habit, date: string, delta: number): void {
    const index = indexCompletions(this.subject.value);
    this.setValue(habit.id, date, amountOn(habit, index, date) + delta);
  }

  setNote(habitId: number, date: string, note: string): void {
    const text = note.trim().slice(0, 500);
    this.upsert(habitId, date, (current) => ({ ...current, note: text || undefined }));
  }

  removeByHabit(habitId: number): void {
    this.persist(this.subject.value.filter((item) => item.habitId !== habitId));
  }

  replaceAll(completions: HabitCompletion[]): void {
    this.persist(completions);
  }

  reload(): void {
    this.subject.next(this.read());
  }

  private upsert(habitId: number, date: string, change: (current: HabitCompletion) => HabitCompletion): void {
    const items = [...this.subject.value];
    const index = items.findIndex((item) => item.habitId === habitId && item.date === date);
    const current: HabitCompletion = index === -1
      ? { id: this.nextId(), habitId, date, completed: false, value: 0 }
      : items[index];
    const next = change(current);
    const empty = !next.completed && !next.note;
    if (index === -1) {
      if (empty) {
        return;
      }
      items.push(next);
    } else if (empty) {
      items.splice(index, 1);
    } else {
      items[index] = next;
    }
    this.persist(items);
  }

  private read(): HabitCompletion[] {
    const value = this.storage.get<HabitCompletion[]>(STORAGE_KEYS.completions);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item) => typeof item?.habitId === 'number' && typeof item?.date === 'string' && typeof item?.completed === 'boolean');
  }

  private persist(completions: HabitCompletion[]): void {
    try {
      this.storage.set(STORAGE_KEYS.completions, completions);
      this.subject.next(completions);
      this.errorSubject.next(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Completion history could not be saved.';
      this.errorSubject.next(message);
      throw new Error(message);
    }
  }

  private nextId(): number {
    this.sequence += 1;
    return Date.now() * 100 + (this.sequence % 100);
  }
}
