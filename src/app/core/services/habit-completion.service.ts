import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { HabitCompletion } from '../models/habit-completion.model';
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

  toggle(habitId: number, date: string): boolean {
    const items = [...this.subject.value];
    const index = items.findIndex((item) => item.habitId === habitId && item.date === date);
    if (index === -1) {
      items.push({
        id: this.nextId(),
        habitId,
        date,
        completed: true,
        completedAt: new Date().toISOString(),
      });
      this.persist(items);
      return true;
    }
    const completed = !items[index].completed;
    items[index] = {
      ...items[index],
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
    this.persist(items);
    return completed;
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

  private read(): HabitCompletion[] {
    try {
      const value = this.storage.get<HabitCompletion[]>(STORAGE_KEYS.completions);
      if (value === null) {
        return [];
      }
      if (!Array.isArray(value)) {
        this.errorSubject.next('Saved completion history is in an unexpected format.');
        return [];
      }
      return value.filter((item) => typeof item?.habitId === 'number' && typeof item?.date === 'string' && typeof item?.completed === 'boolean');
    } catch (error) {
      this.errorSubject.next(error instanceof Error ? error.message : 'Saved completion history could not be read.');
      return [];
    }
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
