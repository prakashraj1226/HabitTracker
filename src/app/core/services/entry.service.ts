import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { DayEntry, EntryType } from '../models/entry.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class EntryService {
  private readonly storage = inject(StorageService);
  private readonly subject = new BehaviorSubject<DayEntry[]>(this.read());
  private sequence = 0;

  readonly entries$ = this.subject.asObservable();

  getAll(): DayEntry[] {
    return this.subject.value;
  }

  create(draft: { date: string; time: string; title: string; type: EntryType; inList: boolean }): DayEntry {
    const entry: DayEntry = {
      id: this.nextId(),
      date: draft.date,
      time: draft.time,
      title: draft.title.trim(),
      type: draft.type,
      done: false,
      inList: draft.inList || draft.type === 'task',
    };
    this.persist([...this.subject.value, entry]);
    return entry;
  }

  toggle(id: number): void {
    this.persist(this.subject.value.map((entry) => (
      entry.id === id ? { ...entry, done: !entry.done } : entry
    )));
  }

  remove(id: number): void {
    this.persist(this.subject.value.filter((entry) => entry.id !== id));
  }

  reload(): void {
    this.subject.next(this.read());
  }

  private read(): DayEntry[] {
    const value = this.storage.get<DayEntry[]>(STORAGE_KEYS.entries);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => typeof entry?.id === 'number' && typeof entry?.date === 'string' && typeof entry?.title === 'string');
  }

  private persist(entries: DayEntry[]): void {
    this.storage.set(STORAGE_KEYS.entries, entries);
    this.subject.next(entries);
  }

  private nextId(): number {
    this.sequence += 1;
    return Date.now() * 100 + (this.sequence % 100);
  }
}
