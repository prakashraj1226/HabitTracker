import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HabitRowComponent } from '../common/habit-row/habit-row.component';
import { IconComponent } from '../common/icon/icon.component';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { formatLongDate, formatMonth, parseDateKey, startOfMonth, toDateKey } from '../core/utils/date.util';
import { monthCells } from '../core/utils/habit-view.util';
import { DayHabit, dayTally, habitsForDay, indexCompletions, isScheduledOn } from '../core/utils/stats.util';

@Component({
  selector: 'app-calendar',
  imports: [RouterLink, IconComponent, HabitRowComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">Calendar</h1>
        <button type="button" class="btn btn--secondary btn--sm" (click)="goToday()">Today</button>
      </header>

      <div class="ht-grid ht-grid--2">
        <article class="ht-card">
          <div class="ht-row" style="margin-bottom: 10px">
            <button type="button" class="ht-icon-btn" aria-label="Previous month" (click)="shiftMonth(-1)"><app-icon name="chevronLeft" /></button>
            <strong>{{ monthLabel() }}</strong>
            <button type="button" class="ht-icon-btn" aria-label="Next month" (click)="shiftMonth(1)"><app-icon name="chevronRight" /></button>
          </div>
          <div class="ht-cal">
            @for (label of weekdayLabels; track $index) { <span class="ht-cal__head">{{ label }}</span> }
            @for (cell of cells(); track cell.key) {
              <button type="button" [class.is-out]="!cell.inMonth" [class.is-today]="cell.key === todayKey"
                      [class.is-picked]="cell.key === selectedKey()" [class.is-full]="cell.level === 'full'"
                      [class.is-part]="cell.level === 'part'" [class.is-miss]="cell.level === 'none'"
                      [class.is-future]="cell.level === 'future'"
                      [attr.aria-label]="cell.label + ': ' + cell.summary" (click)="selectedKey.set(cell.key)">
                {{ cell.day }}
              </button>
            }
          </div>
          <div class="ht-legend">
            <span><i style="background: var(--tick)"></i> All done</span>
            <span><i style="background: var(--warn-soft)"></i> Some done</span>
            <span><i style="background: var(--bad-soft)"></i> None done</span>
          </div>
        </article>

        <article class="ht-card">
          <div class="ht-row">
            <strong>{{ selectedLabel() }}</strong>
            @if (!future() && selectedTally().due) {
              <span class="ht-tag">{{ selectedTally().done }}/{{ selectedTally().due }} done</span>
            }
          </div>

          @if (future()) {
            <p class="ht-muted ht-small" style="margin: 8px 0">Upcoming habits for this day:</p>
            <div class="ht-list">
              @for (item of upcoming(); track item.id) {
                <div class="ht-item"><span class="ht-item__text"><strong>{{ item.name }}</strong><small>{{ item.category }}</small></span></div>
              } @empty {
                <p class="ht-muted">Nothing scheduled.</p>
              }
            </div>
          } @else {
            <h2 class="ht-h2" style="margin-top: 14px">✅ Completed ({{ completed().length }})</h2>
            <div class="ht-list">
              @for (item of completed(); track item.habit.id) {
                <app-habit-row [habit]="item.habit" [date]="selectedKey()" [amount]="item.amount" [meta]="item.habit.category" />
              } @empty {
                <p class="ht-muted ht-small">Nothing completed on this day.</p>
              }
            </div>
            <h2 class="ht-h2">{{ isToday() ? '⏳ Still to do' : '❌ Missed' }} ({{ missed().length }})</h2>
            <div class="ht-list">
              @for (item of missed(); track item.habit.id) {
                <app-habit-row [habit]="item.habit" [date]="selectedKey()" [amount]="item.amount" [meta]="item.habit.category" />
              } @empty {
                <p class="ht-muted ht-small">{{ completed().length ? 'Nothing missed. 🎉' : 'No habits were due.' }}</p>
              }
            </div>
            @if (!habitCount()) {
              <p class="ht-muted" style="margin-top: 12px"><a routerLink="/habits/new">Add a habit</a> to fill your calendar.</p>
            }
          }
        </article>
      </div>
    </section>
  `,
})
export class CalendarComponent {
  private readonly habits = toSignal(inject(HabitService).habits$, { initialValue: [] });
  private readonly completions = toSignal(inject(HabitCompletionService).completions$, { initialValue: [] });

  readonly today = new Date();
  readonly todayKey = toDateKey(this.today);
  readonly weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly month = signal(startOfMonth(this.today));
  readonly selectedKey = signal(this.todayKey);

  private readonly index = computed(() => indexCompletions(this.completions()));
  private readonly active = computed(() => this.habits().filter((habit) => habit.active));
  readonly habitCount = computed(() => this.active().length);
  readonly monthLabel = computed(() => formatMonth(this.month()));

  readonly cells = computed(() => monthCells(this.month()).map(({ date, inMonth }) => {
    const key = toDateKey(date);
    const tally = dayTally(this.active(), this.index(), date, this.today);
    let level: 'full' | 'part' | 'none' | 'empty' | 'future' = 'empty';
    if (key > this.todayKey) {
      level = 'future';
    } else if (tally.due && key !== this.todayKey) {
      level = tally.done === tally.due ? 'full' : tally.done ? 'part' : 'none';
    } else if (tally.due) {
      level = tally.done === tally.due ? 'full' : tally.done ? 'part' : 'empty';
    }
    return {
      key,
      inMonth,
      day: date.getDate(),
      level,
      label: formatLongDate(date),
      summary: tally.due ? `${tally.done} of ${tally.due} done` : 'nothing due',
    };
  }));

  readonly selectedDate = computed(() => parseDateKey(this.selectedKey()));
  readonly selectedLabel = computed(() => formatLongDate(this.selectedDate()));
  readonly future = computed(() => this.selectedKey() > this.todayKey);
  readonly isToday = computed(() => this.selectedKey() === this.todayKey);
  private readonly items = computed<DayHabit[]>(() => habitsForDay(this.active(), this.index(), this.selectedDate(), this.today));
  readonly selectedTally = computed(() => dayTally(this.active(), this.index(), this.selectedDate(), this.today));
  readonly completed = computed(() => this.items().filter((item) => item.state === 'done'));
  readonly missed = computed(() => this.items().filter((item) => ['missed', 'partial', 'open'].includes(item.state)));
  readonly upcoming = computed(() => this.active().filter((habit) => habit.startDate <= this.selectedKey()
    && habit.frequency !== 'WEEKLY' && isScheduledOn(habit, this.selectedDate())));

  shiftMonth(delta: number): void {
    const current = this.month();
    this.month.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  goToday(): void {
    this.month.set(startOfMonth(this.today));
    this.selectedKey.set(this.todayKey);
  }
}
