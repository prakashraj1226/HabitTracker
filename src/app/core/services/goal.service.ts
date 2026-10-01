import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { Goal, GoalPeriod } from '../models/goal.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly storage = inject(StorageService);
  private readonly subject = new BehaviorSubject<Goal[]>(this.read());

  readonly goals$: Observable<Goal[]> = this.subject.asObservable();

  create(habitId: number, target: number, period: GoalPeriod): void {
    const limit = period === 'week' ? 7 : 31;
    const value = Math.round(target);
    if (!(value >= 1 && value <= limit)) {
      throw new Error(`A ${period}ly goal must be between 1 and ${limit} days.`);
    }
    const goal: Goal = { id: Date.now(), habitId, target: value, period, createdAt: new Date().toISOString() };
    this.persist([...this.subject.value.filter((item) => !(item.habitId === habitId && item.period === period)), goal]);
  }

  remove(id: number): void {
    this.persist(this.subject.value.filter((goal) => goal.id !== id));
  }

  removeByHabit(habitId: number): void {
    this.persist(this.subject.value.filter((goal) => goal.habitId !== habitId));
  }

  reload(): void {
    this.subject.next(this.read());
  }

  private read(): Goal[] {
    const value = this.storage.get<Goal[]>(STORAGE_KEYS.goals);
    return Array.isArray(value)
      ? value.filter((goal) => typeof goal?.habitId === 'number' && typeof goal?.target === 'number')
      : [];
  }

  private persist(goals: Goal[]): void {
    this.storage.set(STORAGE_KEYS.goals, goals);
    this.subject.next(goals);
  }
}
