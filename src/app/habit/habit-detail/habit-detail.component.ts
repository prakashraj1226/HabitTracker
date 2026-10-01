import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon/icon.component';
import { EntryService } from '../../core/services/entry.service';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { HabitService } from '../../core/services/habit.service';
import { formatMonth, toDateKey } from '../../core/utils/date.util';
import { findCompletion, habitColor, isDone, monthCells, sameDay } from '../../core/utils/habit-view.util';

@Component({
  selector: 'app-habit-detail',
  imports: [RouterLink, IconComponent],
  template: `
    @if (habit(); as item) {
      <section class="ht-page">
        <header class="ht-top">
          <a class="ht-back" routerLink="/habits" aria-label="Back"><app-icon name="chevronLeft" /></a>
          <h1 class="ht-title" [style.color]="habitColor(item)">
            <app-icon [name]="item.icon || 'star'" />
            {{ item.name }}
          </h1>
          <a class="ht-icon-btn" [routerLink]="['/habits', item.id, 'edit']" aria-label="Edit"><app-icon name="pencil" /></a>
        </header>

        <div class="ht-row" style="margin-bottom:12px">
          <button type="button" class="ht-icon-btn" aria-label="Previous month" (click)="shift(-1)"><app-icon name="chevronLeft" /></button>
          <strong>{{ monthLabel() }}</strong>
          <button type="button" class="ht-icon-btn" aria-label="Next month" (click)="shift(1)"><app-icon name="chevronRight" /></button>
        </div>
        <div class="ht-cal">
          @for (label of weekdayLabels; track label) {
            <span class="ht-muted" style="text-align:center">{{ label }}</span>
          }
          @for (cell of cells(); track cell.date.getTime()) {
            <button
              type="button"
              [class.is-out]="!cell.inMonth"
              [class.is-on]="done(cell.date)"
              [class.is-today]="sameDay(cell.date, today)"
              [style.background]="done(cell.date) ? habitColor(item) : null"
              (click)="toggle(cell.date)">
              {{ cell.date.getDate() }}
            </button>
          }
        </div>

        <div class="ht-row" style="margin-top:22px">
          <h2 class="ht-title" style="font-size:18px">Timeline</h2>
          @if (!noting()) {
            <button type="button" class="ht-chip" (click)="noting.set(true)">+ Add Note</button>
          }
        </div>
        @if (noting()) {
          <form class="ht-row" (submit)="saveNote($event)">
            <input class="ht-field" [value]="note()" placeholder="Note" (input)="onNote($event)" />
            <button class="ht-chip" type="submit">Save</button>
          </form>
        }
        <div class="ht-stack" style="margin-top:12px">
          @for (event of timeline(); track event.id) {
            <article class="ht-card">
              <p class="ht-muted">{{ event.when }}</p>
              <strong>{{ event.label }}</strong>
            </article>
          }
          <article class="ht-card">
            <p class="ht-muted">{{ item.startDate }}</p>
            <strong>Habit started</strong>
          </article>
        </div>
      </section>
    } @else {
      <section class="ht-page">
        <p class="ht-empty">That habit could not be found.</p>
        <a routerLink="/habits">Back to habits</a>
      </section>
    }
  `,
})
export class HabitDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly entries = inject(EntryService);
  private readonly habitList = toSignal(this.habits.habits$, { initialValue: this.habits.getAll() });
  private readonly completionList = toSignal(this.completions.completions$, { initialValue: this.completions.getAll() });
  private readonly entryList = toSignal(this.entries.entries$, { initialValue: this.entries.getAll() });

  readonly weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly today = new Date();
  readonly month = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  readonly noting = signal(false);
  readonly note = signal('');
  readonly habitColor = habitColor;
  readonly sameDay = sameDay;

  readonly habit = computed(() => {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    return (this.habitList() ?? []).find((item) => item.id === id);
  });

  readonly monthLabel = computed(() => formatMonth(this.month()));
  readonly cells = computed(() => monthCells(this.month()));
  readonly timeline = computed(() => {
    const habit = this.habit();
    if (!habit) {
      return [];
    }
    const checks = (this.completionList() ?? [])
      .filter((item) => item.habitId === habit.id && item.completed)
      .map((item) => ({ id: `c-${item.id}`, when: item.date, label: item.value ? `${item.value} ${habit.unit || 'times'}` : 'Completed', sort: item.date }));
    const notes = (this.entryList() ?? [])
      .filter((item) => item.type === 'note' && item.title.startsWith(`${habit.name}:`))
      .map((item) => ({ id: `n-${item.id}`, when: item.date, label: item.title.slice(habit.name.length + 1).trim(), sort: item.date }));
    return [...checks, ...notes].sort((left, right) => right.sort.localeCompare(left.sort)).slice(0, 12);
  });

  shift(amount: number): void {
    const current = this.month();
    this.month.set(new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  done(date: Date): boolean {
    const habit = this.habit();
    if (!habit) {
      return false;
    }
    return isDone(findCompletion(this.completionList() ?? [], habit.id, toDateKey(date)));
  }

  toggle(date: Date): void {
    const habit = this.habit();
    if (!habit) {
      return;
    }
    this.completions.toggle(habit.id, toDateKey(date));
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLInputElement).value);
  }

  saveNote(event: Event): void {
    event.preventDefault();
    const habit = this.habit();
    const text = this.note().trim();
    if (!habit || text.length < 2) {
      return;
    }
    this.entries.create({
      date: toDateKey(this.today),
      time: '12:00',
      title: `${habit.name}: ${text}`,
      type: 'note',
      inList: false,
    });
    this.note.set('');
    this.noting.set(false);
  }
}
