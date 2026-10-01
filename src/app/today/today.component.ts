import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BarsComponent } from '../common/bars/bars.component';
import { HabitRowComponent } from '../common/habit-row/habit-row.component';
import { IconComponent } from '../common/icon/icon.component';
import { Habit } from '../core/models/habit.model';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { StorageService } from '../core/services/storage.service';
import { addDays, formatLongDate, startOfWeek, toDateKey } from '../core/utils/date.util';
import { frequencyLabel, greeting, habitColor } from '../core/utils/habit-view.util';
import {
  DayHabit, dayProgress, doneDaysBetween, habitStats, habitsForDay, indexCompletions, isFlexible,
  percentOf, perfectDayStreaks, periodBars, periodTally, rangeTally, sumTally, weeklyTarget,
} from '../core/utils/stats.util';

@Component({
  selector: 'app-today',
  imports: [RouterLink, IconComponent, BarsComponent, HabitRowComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <div class="ht-hello">
          <h1>{{ hello() }} 👋</h1>
          <p>{{ dateLabel() }}</p>
        </div>
        <a class="ht-icon-btn ht-mobile-only" routerLink="/settings" aria-label="Settings"><app-icon name="gear" /></a>
      </header>

      @if (!active().length) {
        <div class="ht-card ht-empty">
          <p><strong>No habits yet.</strong></p>
          <p>Create your first habit to start tracking your day.</p>
          <a class="btn btn--primary" routerLink="/habits/new"><app-icon name="plus" /> Add habit</a>
        </div>
      } @else {
        <div class="ht-grid ht-grid--2">
          <div class="ht-stack">
            <article class="ht-card ht-hero-card">
              <div class="ht-row">
                <div>
                  <small class="ht-muted">Today's progress</small>
                  <div><strong class="ht-big">{{ progress() }}%</strong></div>
                </div>
                <span class="ht-tag">{{ doneCount() }} of {{ items().length }} done</span>
              </div>
              <div class="ht-meter" style="margin-top: 10px" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
                <i [style.width.%]="progress()"></i>
              </div>
              @if (items().length && doneCount() === items().length) {
                <p class="ht-small" style="margin-top: 10px">All done for today. Great work! 🎉</p>
              }
            </article>

            <h2 class="ht-h2">Today's habits <a routerLink="/habits">All habits</a></h2>
            @if (items().length) {
              <div class="ht-list">
                @for (item of items(); track item.habit.id) {
                  <app-habit-row [habit]="item.habit" [date]="todayKey()" [amount]="item.amount" [meta]="metaFor(item)" />
                }
              </div>
            } @else {
              <p class="ht-card ht-empty">Nothing is due today. Enjoy your day off!</p>
            }
          </div>

          <div class="ht-stack">
            <div class="ht-kpis" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
              <div class="ht-kpi"><small>🔥 Current streak</small><strong>{{ streaks().current }}</strong><span>perfect days</span></div>
              <div class="ht-kpi"><small>🏆 Best streak</small><strong>{{ streaks().best }}</strong><span>perfect days</span></div>
              <div class="ht-kpi"><small>✅ Total completed</small><strong>{{ totalDone() }}</strong><span>all time</span></div>
              <div class="ht-kpi"><small>❌ Missed</small><strong>{{ missed() }}</strong><span>last 7 days</span></div>
            </div>

            <article class="ht-card">
              <div class="ht-row">
                <strong>This week</strong>
                <span class="ht-muted ht-small">Week {{ weekPct() }} · Month {{ monthPct() }}</span>
              </div>
              <app-bars [bars]="weekBars()" [height]="110" />
            </article>

            <article class="ht-card">
              <div class="ht-row"><strong>Habit stats</strong><a class="ht-small" routerLink="/stats" style="color: var(--accent); text-decoration: none">See all</a></div>
              <table class="ht-table" style="margin-top: 6px">
                <thead><tr><th>Habit</th><th>Week</th><th>Streak</th></tr></thead>
                <tbody>
                  @for (row of habitRows(); track row.habit.id) {
                    <tr>
                      <td><a [routerLink]="['/habits', row.habit.id]"><span class="ht-swatch" style="width: 10px; height: 10px; margin: 0" [style.background]="color(row.habit)"></span>{{ row.habit.name }}</a></td>
                      <td>{{ row.week }}</td>
                      <td>{{ row.streak }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </article>
          </div>
        </div>
      }
    </section>
  `,
})
export class TodayComponent {
  private readonly habitService = inject(HabitService);
  private readonly completionService = inject(HabitCompletionService);
  private readonly habits = toSignal(this.habitService.habits$, { initialValue: [] });
  private readonly completions = toSignal(this.completionService.completions$, { initialValue: [] });
  private readonly settings = toSignal(inject(StorageService).settings$);
  private readonly now = signal(new Date());

  readonly active = computed(() => this.habits().filter((habit) => habit.active));
  readonly index = computed(() => indexCompletions(this.completions()));
  readonly todayKey = computed(() => toDateKey(this.now()));
  readonly hello = computed(() => {
    const name = this.settings()?.displayName;
    return name ? `${greeting(this.now())}, ${name}` : greeting(this.now());
  });
  readonly dateLabel = computed(() => formatLongDate(this.now()));

  readonly items = computed(() => habitsForDay(this.active(), this.index(), this.now(), this.now())
    .sort((left, right) => Number(left.state === 'done') - Number(right.state === 'done')));
  readonly doneCount = computed(() => this.items().filter((item) => item.state === 'done').length);
  readonly progress = computed(() => dayProgress(this.items()));
  readonly streaks = computed(() => perfectDayStreaks(this.active(), this.index(), this.now()));
  readonly stats = computed(() => new Map(this.active().map((habit) => [habit.id, habitStats(habit, this.index(), this.now())])));
  readonly totalDone = computed(() => [...this.stats().values()].reduce((sum, item) => sum + item.total, 0));
  readonly missed = computed(() => {
    const from = addDays(this.now(), -7);
    const to = addDays(this.now(), -1);
    const tally = sumTally(this.active().map((habit) => rangeTally(habit, this.index(), from, to, this.now())));
    return tally.due - tally.done;
  });
  readonly weekBars = computed(() => periodBars(this.active(), this.index(), 'week', this.now()));
  readonly weekPct = computed(() => formatPercent(percentOf(periodTally(this.active(), this.index(), 'week', this.now()))));
  readonly monthPct = computed(() => formatPercent(percentOf(periodTally(this.active(), this.index(), 'month', this.now()))));
  readonly habitRows = computed(() => this.active().map((habit) => {
    const stats = this.stats().get(habit.id);
    const week = rangeTally(habit, this.index(), startOfWeek(this.now()), this.now(), this.now());
    return {
      habit,
      week: formatPercent(percentOf(week)),
      streak: `${stats?.current ?? 0} ${stats?.unit === 'week' ? 'wk' : 'd'}`,
    };
  }));

  constructor() {
    const timer = window.setInterval(() => {
      if (toDateKey(new Date()) !== this.todayKey() || new Date().getHours() !== this.now().getHours()) {
        this.now.set(new Date());
      }
    }, 60000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  metaFor(item: DayHabit): string {
    const habit = item.habit;
    const stats = this.stats().get(habit.id);
    const parts: string[] = [];
    if (isFlexible(habit)) {
      const done = doneDaysBetween(habit, this.index(), startOfWeek(this.now()), this.now());
      parts.push(`${done}/${weeklyTarget(habit)} this week`);
    } else {
      parts.push(frequencyLabel(habit));
    }
    if (habit.kind === 'measurable') {
      parts.push(`${habit.target} ${habit.unit}`);
    }
    if (stats?.current) {
      parts.push(`🔥 ${stats.current}${stats.unit === 'week' ? ' wk' : ''}`);
    }
    return parts.join(' · ');
  }

  color(habit: Habit): string {
    return habitColor(habit);
  }
}

function formatPercent(value: number | null): string {
  return value === null ? '–' : `${value}%`;
}
