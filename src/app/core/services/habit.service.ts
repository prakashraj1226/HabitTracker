import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DEFAULT_COLOR, STORAGE_KEYS } from '../constants/habit.constants';
import { Habit, HabitDraft, HabitFrequency, HabitKind, HabitReminder } from '../models/habit.model';
import { isValidDateKey } from '../utils/date.util';
import { GoalService } from './goal.service';
import { HabitCompletionService } from './habit-completion.service';
import { ReminderService } from './reminder.service';
import { StorageService } from './storage.service';

const FREQUENCIES: HabitFrequency[] = ['DAILY', 'CUSTOM', 'WEEKLY', 'MONTHLY'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_REMINDERS = 5;

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly storage = inject(StorageService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly goalService = inject(GoalService);
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
    const now = new Date().toISOString();
    const habit: Habit = { ...normalizeDraft(draft), id: this.nextId(), createdAt: now, updatedAt: now };
    this.persist([...this.subject.value, habit]);
    return habit;
  }

  update(id: number, draft: HabitDraft): Habit {
    const existing = this.require(id);
    const updated: Habit = {
      ...existing,
      ...normalizeDraft(draft),
      reminderTime: undefined,
      reminderEnabled: undefined,
      repeat: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.persist(this.subject.value.map((habit) => (habit.id === id ? updated : habit)));
    return updated;
  }

  delete(id: number): void {
    this.require(id);
    this.persist(this.subject.value.filter((habit) => habit.id !== id));
    this.completionService.removeByHabit(id);
    this.goalService.removeByHabit(id);
  }

  archive(id: number): void {
    this.setActive(id, false);
  }

  restore(id: number): void {
    this.setActive(id, true);
  }

  replaceAll(habits: Habit[]): void {
    this.persist(habits.map(migrateHabit));
  }

  reload(): void {
    this.subject.next(this.read());
  }

  private require(id: number): Habit {
    const habit = this.getById(id);
    if (!habit) {
      throw new Error('That habit could not be found.');
    }
    return habit;
  }

  private read(): Habit[] {
    const value = this.storage.get<Habit[]>(STORAGE_KEYS.habits);
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((habit) => typeof habit?.id === 'number' && typeof habit?.name === 'string')
      .map(migrateHabit);
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
    this.require(id);
    this.persist(this.subject.value.map((habit) => (
      habit.id === id ? { ...habit, active, updatedAt: new Date().toISOString() } : habit
    )));
  }

  private nextId(): number {
    this.sequence += 1;
    return Date.now() * 100 + (this.sequence % 100);
  }
}

export function validateDraft(draft: HabitDraft): string | null {
  try {
    normalizeDraft(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Check the habit details.';
  }
}

function normalizeDraft(draft: HabitDraft): HabitDraft {
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
    throw new Error('Choose a category (2–24 characters).');
  }
  if (!FREQUENCIES.includes(draft.frequency)) {
    throw new Error('Choose how often this habit repeats.');
  }
  if (!isValidDateKey(draft.startDate)) {
    throw new Error('Choose a valid start date.');
  }
  const days = [...new Set((draft.daysOfWeek ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  if (draft.frequency === 'CUSTOM' && days.length === 0) {
    throw new Error('Pick at least one day of the week.');
  }
  const timesPerWeek = Math.round(Number(draft.timesPerWeek));
  if (draft.frequency === 'WEEKLY' && !(timesPerWeek >= 1 && timesPerWeek <= 7)) {
    throw new Error('Times per week must be between 1 and 7.');
  }
  const dayOfMonth = Math.round(Number(draft.dayOfMonth));
  if (draft.frequency === 'MONTHLY' && !(dayOfMonth >= 1 && dayOfMonth <= 31)) {
    throw new Error('Day of the month must be between 1 and 31.');
  }
  const kind: HabitKind = draft.kind === 'measurable' ? 'measurable' : 'tick';
  const target = Math.round(Number(draft.target));
  if (!(target >= 1 && target <= 999)) {
    throw new Error(kind === 'measurable' ? 'Daily target must be between 1 and 999.' : 'Times per day must be between 1 and 999.');
  }
  const unit = draft.unit?.trim() ?? '';
  if (kind === 'measurable' && (unit.length < 1 || unit.length > 20)) {
    throw new Error('Enter a unit such as glasses, pages or minutes.');
  }
  const reminders = (draft.reminders ?? []).slice(0, MAX_REMINDERS);
  for (const reminder of reminders) {
    if (!TIME_PATTERN.test(reminder.time)) {
      throw new Error('Every reminder needs a valid time.');
    }
    if (reminder.message.trim().length > 80) {
      throw new Error('Keep reminder messages under 80 characters.');
    }
  }
  return {
    name,
    description: description || undefined,
    category,
    frequency: draft.frequency,
    startDate: draft.startDate,
    color: draft.color || DEFAULT_COLOR,
    icon: draft.icon || 'star',
    active: draft.active !== false,
    daysOfWeek: draft.frequency === 'CUSTOM' ? days : undefined,
    timesPerWeek: draft.frequency === 'WEEKLY' ? timesPerWeek : undefined,
    dayOfMonth: draft.frequency === 'MONTHLY' ? dayOfMonth : undefined,
    kind,
    intent: kind === 'tick' && draft.intent === 'quit' ? 'quit' : 'build',
    unit: kind === 'measurable' ? unit : undefined,
    target,
    reminders: reminders.map((reminder, index) => ({
      id: reminder.id || index + 1,
      time: reminder.time,
      enabled: reminder.enabled !== false,
      message: reminder.message.trim(),
      repeat: reminder.repeat === 'scheduled' ? 'scheduled' : 'daily',
    })),
  };
}

function migrateHabit(habit: Habit): Habit {
  const kind: HabitKind = habit.kind === 'measurable' ? 'measurable' : 'tick';
  let frequency: HabitFrequency = FREQUENCIES.includes(habit.frequency) ? habit.frequency : 'DAILY';
  if (habit.repeat === 'weekly') {
    frequency = 'WEEKLY';
  }
  if (frequency === 'CUSTOM' && !habit.daysOfWeek?.length) {
    frequency = 'DAILY';
  }
  const legacyTarget = habit.repeat === 'multiple' ? 2 : 1;
  const target = Number.isFinite(habit.target) ? Math.min(999, Math.max(1, Math.round(habit.target as number))) : kind === 'measurable' ? 8 : legacyTarget;
  let reminders: HabitReminder[] = Array.isArray(habit.reminders) ? habit.reminders.filter((item) => TIME_PATTERN.test(item?.time)) : [];
  if (!Array.isArray(habit.reminders) && habit.reminderTime && TIME_PATTERN.test(habit.reminderTime)) {
    reminders = [{ id: 1, time: habit.reminderTime, enabled: habit.reminderEnabled !== false, message: '', repeat: 'daily' }];
  }
  return {
    ...habit,
    frequency,
    kind,
    intent: kind === 'tick' && habit.intent === 'quit' ? 'quit' : 'build',
    unit: kind === 'measurable' ? habit.unit || 'times' : undefined,
    target: frequency === 'WEEKLY' && habit.repeat === 'weekly' && kind === 'tick' ? 1 : target,
    timesPerWeek: frequency === 'WEEKLY' ? Math.min(7, Math.max(1, habit.timesPerWeek ?? (habit.repeat === 'weekly' ? habit.target ?? 1 : 1))) : undefined,
    dayOfMonth: frequency === 'MONTHLY' ? Math.min(31, Math.max(1, habit.dayOfMonth ?? 1)) : undefined,
    daysOfWeek: frequency === 'CUSTOM' ? habit.daysOfWeek : undefined,
    reminders: reminders.map((item) => ({
      id: item.id,
      time: item.time,
      enabled: item.enabled !== false,
      message: typeof item.message === 'string' ? item.message : '',
      repeat: item.repeat === 'scheduled' ? 'scheduled' : 'daily',
    })),
    reminderTime: undefined,
    reminderEnabled: undefined,
    repeat: undefined,
    color: habit.color || DEFAULT_COLOR,
    icon: habit.icon || 'star',
    category: habit.category || 'Other',
    active: habit.active !== false,
  };
}
