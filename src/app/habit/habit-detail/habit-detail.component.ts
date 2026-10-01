import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BarsComponent } from '../../common/bars/bars.component';
import { ConfirmationDialogComponent } from '../../common/confirmation-dialog/confirmation-dialog.component';
import { HabitRowComponent } from '../../common/habit-row/habit-row.component';
import { IconComponent } from '../../common/icon/icon.component';
import { GoalPeriod } from '../../core/models/goal.model';
import { GoalService } from '../../core/services/goal.service';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { HabitService } from '../../core/services/habit.service';
import { addDays, endOfMonth, formatLongDate, formatMediumDate, formatMonth, parseDateKey, startOfMonth, toDateKey } from '../../core/utils/date.util';
import { formatClock, frequencyLabel, habitColor, monthCells, targetLabel } from '../../core/utils/habit-view.util';
import {
  DayState, Period, amountOn, completionOf, dayState, goalProgress, habitStats, indexCompletions, periodBars, percentOf,
  periodRange, rangeTally,
} from '../../core/utils/stats.util';

@Component({
  selector: 'app-habit-detail',
  imports: [RouterLink, IconComponent, BarsComponent, HabitRowComponent, ConfirmationDialogComponent],
  template: `
    <section class="ht-page">
      @if (habit(); as habit) {
        <header class="ht-top">
          <a class="ht-back" routerLink="/habits" aria-label="Back to habits"><app-icon name="chevronLeft" /></a>
          <h1 class="ht-title">{{ habit.name }}</h1>
          <a class="ht-icon-btn" [routerLink]="['/habits', habit.id, 'edit']" aria-label="Edit habit"><app-icon name="pencil" /></a>
          <button type="button" class="ht-icon-btn" aria-label="More actions" (click)="menuOpen.set(!menuOpen())"><app-icon name="more" /></button>
          @if (menuOpen()) {
            <div class="ht-menu" style="top: 56px">
              @if (habit.active) {
                <button type="button" (click)="archive()"><app-icon name="archive" /> Archive</button>
              } @else {
                <button type="button" (click)="restore()"><app-icon name="reset" /> Restore</button>
              }
              <button type="button" class="danger" (click)="confirmDelete.set(true)"><app-icon name="trash" /> Delete</button>
            </div>
          }
        </header>

        <div class="ht-grid ht-grid--2">
          <div class="ht-stack">
            <article class="ht-card">
              <div class="ht-card__head">
                <span class="ht-badge" [style.background]="color()"><app-icon [name]="habit.icon || 'star'" /></span>
                <div style="min-width: 0">
                  <p class="ht-muted ht-small">{{ habit.kind === 'measurable' ? 'Measurable' : habit.intent === 'quit' ? 'Quit habit' : 'Tick habit' }}</p>
                  @if (habit.description) { <p>{{ habit.description }}</p> }
                </div>
              </div>
              <div class="ht-card__meta" style="margin-top: 12px">
                <span class="ht-tag">{{ habit.category }}</span>
                <span class="ht-tag">{{ frequency() }}</span>
                @if (target()) { <span class="ht-tag">{{ target() }}</span> }
                <span class="ht-tag">Since {{ started() }}</span>
                @if (!habit.active) { <span class="ht-tag ht-tag--warn">Archived</span> }
                @for (reminder of habit.reminders ?? []; track reminder.id) {
                  <span class="ht-tag" [style.opacity]="reminder.enabled ? 1 : 0.5"><app-icon name="bell" /> {{ clock(reminder.time) }}</span>
                }
              </div>
            </article>

            <div class="ht-kpis">
              <div class="ht-kpi"><small>Completion</small><strong>{{ stats().rate }}%</strong><span>of due {{ stats().unit }}s</span></div>
              <div class="ht-kpi"><small>🔥 Current</small><strong>{{ stats().current }}</strong><span>{{ stats().unit }}s</span></div>
              <div class="ht-kpi"><small>🏆 Best</small><strong>{{ stats().best }}</strong><span>{{ stats().unit }}s</span></div>
              <div class="ht-kpi"><small>✅ Total</small><strong>{{ stats().total }}</strong><span>❌ {{ stats().missed }} missed</span></div>
            </div>

            <article class="ht-card">
              <div class="ht-row">
                <div class="ht-seg" style="margin: 0">
                  @for (item of periods; track item.id) {
                    <button type="button" [class.is-on]="period() === item.id" (click)="period.set(item.id)">{{ item.label }}</button>
                  }
                </div>
                <strong>{{ periodPct() }}</strong>
              </div>
              <app-bars [bars]="bars()" [color]="color()" />
            </article>

            <article class="ht-card ht-goal">
              <strong>Goals</strong>
              @for (goal of goals(); track goal.id) {
                <div>
                  <div class="ht-goal__row">
                    <strong>{{ goal.target }} days per {{ goal.period }}</strong>
                    <span class="ht-muted">{{ goal.done }}/{{ goal.target }}</span>
                    <button type="button" class="ht-icon-btn" aria-label="Remove goal" (click)="removeGoal(goal.id)"><app-icon name="trash" /></button>
                  </div>
                  <div class="ht-meter ht-meter--thin"><i [style.width.%]="goal.percent" [style.background]="color()"></i></div>
                </div>
              } @empty {
                <p class="ht-muted ht-small">Set a target such as 5 days per week.</p>
              }
              <div class="ht-number">
                <input class="ht-field" type="number" min="1" [max]="goalPeriod() === 'week' ? 7 : 31" [value]="goalTarget()"
                       (input)="goalTarget.set(number($event))" aria-label="Goal days" style="width: 80px; margin: 0" />
                <span>days per</span>
                <select class="ht-select" [value]="goalPeriod()" (change)="goalPeriod.set($any(text($event)))" aria-label="Goal period">
                  <option value="week">week</option>
                  <option value="month">month</option>
                </select>
                <button type="button" class="btn btn--secondary" (click)="addGoal()">Set goal</button>
              </div>
              @if (goalError()) { <p class="ht-error">{{ goalError() }}</p> }
            </article>
          </div>

          <div class="ht-stack">
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
                          [class.is-picked]="cell.key === selectedKey()" [class.is-on]="cell.state === 'done'"
                          [class.is-part]="cell.state === 'partial'" [class.is-miss]="cell.state === 'missed'"
                          [class.is-future]="cell.state === 'future'"
                          [style.background]="cell.state === 'done' ? color() : null"
                          [attr.aria-label]="cell.label + ': ' + cell.state" (click)="selectedKey.set(cell.key)">
                    {{ cell.day }}
                    @if (cell.note) { <i></i> }
                  </button>
                }
              </div>
              <div class="ht-legend">
                <span><i [style.background]="color()"></i> Done</span>
                <span><i style="background: var(--warn-soft)"></i> Partial</span>
                <span><i style="background: var(--bad-soft)"></i> Missed</span>
              </div>
            </article>

            <article class="ht-card">
              <strong>{{ selectedLabel() }}</strong>
              @if (selectedFuture()) {
                <p class="ht-muted ht-small" style="margin-top: 6px">This day is in the future.</p>
              } @else {
                <div style="margin-top: 10px">
                  <app-habit-row [habit]="habit" [date]="selectedKey()" [amount]="selectedAmount()" [meta]="selectedStateLabel()" [readonly]="!habit.active" />
                </div>
                <p class="ht-label" style="margin-top: 14px">Note</p>
                <textarea class="ht-field" rows="3" maxlength="500" placeholder="How did it go?" [value]="noteDraft()"
                          (input)="noteDraft.set(text($event))" aria-label="Note for this day"></textarea>
                <div class="ht-row" style="margin-top: 8px">
                  <span class="ht-muted ht-small">{{ noteSaved() ? 'Saved' : '' }}</span>
                  <button type="button" class="btn btn--primary btn--sm" [disabled]="noteDraft() === savedNote()" (click)="saveNote()">Save note</button>
                </div>
              }
            </article>

            <article class="ht-card">
              <strong>History · {{ monthLabel() }}</strong>
              <div class="ht-history" style="margin-top: 6px">
                @for (row of history(); track row.key) {
                  <button type="button" [class.is-picked]="row.key === selectedKey()" (click)="selectedKey.set(row.key)">
                    <span>{{ row.label }}</span>
                    <span>{{ row.icon }}</span>
                    <span>
                      {{ row.text }}
                      @if (row.note) { <small> · {{ row.note }}</small> }
                    </span>
                  </button>
                } @empty {
                  <p class="ht-muted ht-small" style="padding: 10px 0">No scheduled days yet this month.</p>
                }
              </div>
            </article>
          </div>
        </div>
      } @else {
        <div class="ht-empty">
          <p>This habit could not be found.</p>
          <a class="btn btn--secondary" routerLink="/habits">Back to habits</a>
        </div>
      }
    </section>

    <app-confirmation-dialog
      [open]="confirmDelete()"
      title="Delete habit"
      [message]="'Delete ' + (habit()?.name || 'this habit') + '? Its history, notes and goals will be removed.'"
      confirmLabel="Delete"
      (cancelled)="confirmDelete.set(false)"
      (confirmed)="remove()" />
  `,
})
export class HabitDetailComponent {
  private readonly habitService = inject(HabitService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly goalService = inject(GoalService);
  private readonly router = inject(Router);
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get('id')))), { initialValue: NaN });
  private readonly habits = toSignal(this.habitService.habits$, { initialValue: this.habitService.getAll() });
  private readonly completions = toSignal(this.completionService.completions$, { initialValue: this.completionService.getAll() });
  private readonly allGoals = toSignal(this.goalService.goals$, { initialValue: [] });

  readonly today = new Date();
  readonly todayKey = toDateKey(this.today);
  readonly weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly periods: { id: Period; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];

  readonly menuOpen = signal(false);
  readonly confirmDelete = signal(false);
  readonly period = signal<Period>('week');
  readonly month = signal(startOfMonth(this.today));
  readonly selectedKey = signal(this.todayKey);
  readonly noteDraft = signal('');
  readonly noteSaved = signal(false);
  readonly goalTarget = signal(5);
  readonly goalPeriod = signal<GoalPeriod>('week');
  readonly goalError = signal('');

  readonly habit = computed(() => this.habits().find((habit) => habit.id === this.id()));
  readonly index = computed(() => indexCompletions(this.completions()));
  readonly color = computed(() => (this.habit() ? habitColor(this.habit()!) : 'var(--accent)'));
  readonly frequency = computed(() => (this.habit() ? frequencyLabel(this.habit()!) : ''));
  readonly target = computed(() => (this.habit() ? targetLabel(this.habit()!) : ''));
  readonly started = computed(() => (this.habit() ? formatMediumDate(parseDateKey(this.habit()!.startDate)) : ''));
  readonly stats = computed(() => habitStats(this.habit()!, this.index(), this.today));
  readonly bars = computed(() => periodBars([this.habit()!], this.index(), this.period(), this.today));
  readonly periodPct = computed(() => {
    const { from, to } = periodRange(this.period(), this.today);
    const value = percentOf(rangeTally(this.habit()!, this.index(), from, to, this.today));
    return value === null ? '–' : `${value}%`;
  });
  readonly goals = computed(() => {
    const habit = this.habit();
    if (!habit) {
      return [];
    }
    return this.allGoals()
      .filter((goal) => goal.habitId === habit.id)
      .map((goal) => ({ ...goal, ...goalProgress(goal, habit, this.index(), this.today) }));
  });

  readonly monthLabel = computed(() => formatMonth(this.month()));
  readonly cells = computed(() => {
    const habit = this.habit()!;
    return monthCells(this.month()).map(({ date, inMonth }) => {
      const key = toDateKey(date);
      return {
        key,
        inMonth,
        day: date.getDate(),
        label: formatLongDate(date),
        state: dayState(habit, this.index(), date, this.today),
        note: !!completionOf(this.index(), habit.id, key)?.note,
      };
    });
  });
  readonly history = computed(() => {
    const habit = this.habit()!;
    const first = this.month();
    const last = endOfMonth(first) < this.today ? endOfMonth(first) : this.today;
    const rows = [];
    for (let date = last; date >= first; date = addDays(date, -1)) {
      const key = toDateKey(date);
      const state = dayState(habit, this.index(), date, this.today);
      const note = completionOf(this.index(), habit.id, key)?.note;
      if (state === 'off' && !note) {
        continue;
      }
      rows.push({
        key,
        label: date.toLocaleDateString('en-GB', { day: '2-digit', weekday: 'short' }),
        icon: STATE_ICON[state],
        text: this.describe(state, amountOn(habit, this.index(), key)),
        note,
      });
    }
    return rows;
  });

  readonly selectedDate = computed(() => parseDateKey(this.selectedKey()));
  readonly selectedFuture = computed(() => this.selectedKey() > this.todayKey);
  readonly selectedLabel = computed(() => formatLongDate(this.selectedDate()));
  readonly selectedAmount = computed(() => (this.habit() ? amountOn(this.habit()!, this.index(), this.selectedKey()) : 0));
  readonly selectedStateLabel = computed(() => {
    const habit = this.habit();
    if (!habit) {
      return '';
    }
    const state = dayState(habit, this.index(), this.selectedDate(), this.today);
    return this.describe(state, this.selectedAmount());
  });
  readonly savedNote = computed(() => {
    const habit = this.habit();
    return habit ? completionOf(this.index(), habit.id, this.selectedKey())?.note ?? '' : '';
  });

  constructor() {
    effect(() => {
      this.noteDraft.set(this.savedNote());
      this.noteSaved.set(false);
    });
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  number(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  clock(time: string): string {
    return formatClock(time);
  }

  shiftMonth(delta: number): void {
    const current = this.month();
    this.month.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  saveNote(): void {
    const habit = this.habit();
    if (!habit) {
      return;
    }
    this.completionService.setNote(habit.id, this.selectedKey(), this.noteDraft());
    this.noteSaved.set(true);
  }

  addGoal(): void {
    const habit = this.habit();
    if (!habit) {
      return;
    }
    try {
      this.goalService.create(habit.id, this.goalTarget(), this.goalPeriod());
      this.goalError.set('');
    } catch (error) {
      this.goalError.set(error instanceof Error ? error.message : 'The goal could not be saved.');
    }
  }

  removeGoal(id: number): void {
    this.goalService.remove(id);
  }

  archive(): void {
    this.menuOpen.set(false);
    this.habitService.archive(this.id());
  }

  restore(): void {
    this.menuOpen.set(false);
    this.habitService.restore(this.id());
  }

  remove(): void {
    this.habitService.delete(this.id());
    this.confirmDelete.set(false);
    void this.router.navigateByUrl('/habits');
  }

  private describe(state: DayState, amount: number): string {
    const habit = this.habit();
    const progress = habit && (habit.kind === 'measurable' || (habit.target ?? 1) > 1)
      ? ` · ${amount}/${habit.target}${habit.unit ? ' ' + habit.unit : ''}`
      : '';
    return `${STATE_TEXT[state]}${progress}`;
  }
}

const STATE_ICON: Record<DayState, string> = {
  done: '✅', partial: '◐', missed: '❌', open: '⏳', off: '·', future: '·',
};

const STATE_TEXT: Record<DayState, string> = {
  done: 'Completed', partial: 'Partly done', missed: 'Missed', open: 'Not done yet', off: 'Not scheduled', future: 'Upcoming',
};
