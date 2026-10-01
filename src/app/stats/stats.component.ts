import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BarsComponent } from '../common/bars/bars.component';
import { IconComponent } from '../common/icon/icon.component';
import { GoalPeriod } from '../core/models/goal.model';
import { Habit } from '../core/models/habit.model';
import { AchievementService } from '../core/services/achievement.service';
import { GoalService } from '../core/services/goal.service';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { formatMediumDate, startOfDay } from '../core/utils/date.util';
import { habitColor } from '../core/utils/habit-view.util';
import {
  ACHIEVEMENTS, Period, dayProgress, goalProgress, habitStats, habitsForDay, indexCompletions, percentOf, perfectDayStreaks,
  periodBars, periodRange, periodTally, rangeTally,
} from '../core/utils/stats.util';

type StatsTab = 'overview' | 'goals' | 'achievements';

@Component({
  selector: 'app-stats',
  imports: [RouterLink, IconComponent, BarsComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">Statistics</h1>
      </header>

      <div class="ht-seg" role="tablist">
        @for (item of tabs; track item.id) {
          <button type="button" role="tab" [class.is-on]="tab() === item.id" [attr.aria-selected]="tab() === item.id" (click)="tab.set(item.id)">
            {{ item.label }}
          </button>
        }
      </div>

      @if (!active().length && tab() !== 'achievements') {
        <div class="ht-card ht-empty">
          <p>Statistics appear once you have habits.</p>
          <a class="btn btn--primary" routerLink="/habits/new"><app-icon name="plus" /> Add habit</a>
        </div>
      } @else if (tab() === 'overview') {
        <div class="ht-kpis">
          <div class="ht-kpi"><small>Today</small><strong>{{ todayPct() }}%</strong><span>progress</span></div>
          <div class="ht-kpi"><small>This week</small><strong>{{ pct('week') }}</strong><span>completion</span></div>
          <div class="ht-kpi"><small>This month</small><strong>{{ pct('month') }}</strong><span>completion</span></div>
          <div class="ht-kpi"><small>This year</small><strong>{{ pct('year') }}</strong><span>completion</span></div>
          <div class="ht-kpi"><small>🔥 Current streak</small><strong>{{ streaks().current }}</strong><span>perfect days</span></div>
          <div class="ht-kpi"><small>🏆 Best streak</small><strong>{{ streaks().best }}</strong><span>perfect days</span></div>
          <div class="ht-kpi"><small>✅ Completed</small><strong>{{ totals().done }}</strong><span>all time</span></div>
          <div class="ht-kpi"><small>❌ Missed</small><strong>{{ totals().missed }}</strong><span>all time</span></div>
        </div>

        <article class="ht-card" style="margin-top: 14px">
          <div class="ht-row">
            <div class="ht-seg" style="margin: 0">
              @for (item of periods; track item.id) {
                <button type="button" [class.is-on]="period() === item.id" (click)="period.set(item.id)">{{ item.label }}</button>
              }
            </div>
            <span class="ht-muted ht-small">{{ periodCaption() }}</span>
          </div>
          <app-bars [bars]="bars()" [height]="150" />
        </article>

        <h2 class="ht-h2">Per habit · {{ periodName() }}</h2>
        <article class="ht-card ht-table-wrap">
          <table class="ht-table">
            <thead>
              <tr><th>Habit</th><th>{{ periodName() }}</th><th>Rate</th><th>Streak</th><th>Best</th><th>Total</th></tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.habit.id) {
                <tr>
                  <td><a [routerLink]="['/habits', row.habit.id]"><span class="ht-swatch" style="width: 10px; height: 10px; margin: 0" [style.background]="color(row.habit)"></span>{{ row.habit.name }}</a></td>
                  <td>{{ row.period }}</td>
                  <td>{{ row.stats.rate }}%</td>
                  <td>{{ row.stats.current }}{{ row.stats.unit === 'week' ? ' wk' : ' d' }}</td>
                  <td>{{ row.stats.best }}{{ row.stats.unit === 'week' ? ' wk' : ' d' }}</td>
                  <td>{{ row.stats.total }}</td>
                </tr>
              }
            </tbody>
          </table>
        </article>
      } @else if (tab() === 'goals') {
        <article class="ht-card ht-goal">
          <strong>New goal</strong>
          <div class="ht-number">
            <select class="ht-select" [value]="goalHabit()" (change)="goalHabit.set(numberOf($event))" aria-label="Habit">
              @for (habit of active(); track habit.id) { <option [value]="habit.id">{{ habit.name }}</option> }
            </select>
            <input class="ht-field" type="number" min="1" [max]="goalPeriod() === 'week' ? 7 : 31" [value]="goalTarget()"
                   (input)="goalTarget.set(numberOf($event))" aria-label="Days" style="width: 80px; margin: 0" />
            <span>days per</span>
            <select class="ht-select" [value]="goalPeriod()" (change)="goalPeriod.set($any(textOf($event)))" aria-label="Period">
              <option value="week">week</option>
              <option value="month">month</option>
            </select>
            <button type="button" class="btn btn--primary" (click)="addGoal()">Add goal</button>
          </div>
          @if (goalError()) { <p class="ht-error">{{ goalError() }}</p> }
        </article>

        <div class="ht-grid ht-grid--2" style="margin-top: 14px">
          @for (goal of goals(); track goal.id) {
            <article class="ht-card ht-goal">
              <div class="ht-goal__row">
                <span class="ht-badge ht-badge--sm" [style.background]="color(goal.habit)"><app-icon [name]="goal.habit.icon || 'star'" /></span>
                <strong>{{ goal.habit.name }}<br /><span class="ht-muted ht-small">{{ goal.target }} days per {{ goal.period }}</span></strong>
                <button type="button" class="ht-icon-btn" aria-label="Remove goal" (click)="removeGoal(goal.id)"><app-icon name="trash" /></button>
              </div>
              <div class="ht-row">
                <span class="ht-muted ht-small">{{ goal.percent >= 100 ? 'Goal reached 🎉' : 'This ' + goal.period }}</span>
                <strong>{{ goal.done }} / {{ goal.target }}</strong>
              </div>
              <div class="ht-meter"><i [style.width.%]="goal.percent" [style.background]="color(goal.habit)"></i></div>
            </article>
          } @empty {
            <p class="ht-muted">No goals yet. Example: Gym — 5 days per week.</p>
          }
        </div>
      } @else {
        <p class="ht-muted" style="margin-bottom: 12px">{{ unlockedCount() }} of {{ achievements().length }} unlocked</p>
        <div class="ht-achv">
          @for (item of achievements(); track item.id) {
            <article [class.is-locked]="!item.unlockedAt">
              <b>{{ item.icon }}</b>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
              <p>{{ item.unlockedAt ? 'Unlocked ' + item.unlockedAt : 'Locked' }}</p>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class StatsComponent {
  private readonly goalService = inject(GoalService);
  private readonly habits = toSignal(inject(HabitService).habits$, { initialValue: [] });
  private readonly completions = toSignal(inject(HabitCompletionService).completions$, { initialValue: [] });
  private readonly allGoals = toSignal(this.goalService.goals$, { initialValue: [] });
  private readonly unlocked = toSignal(inject(AchievementService).unlocked$, { initialValue: [] });

  readonly today = startOfDay(new Date());
  readonly tabs: { id: StatsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'goals', label: 'Goals' },
    { id: 'achievements', label: 'Achievements' },
  ];
  readonly periods: { id: Period; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];

  readonly tab = signal<StatsTab>('overview');
  readonly period = signal<Period>('week');
  readonly goalHabit = signal(0);
  readonly goalTarget = signal(5);
  readonly goalPeriod = signal<GoalPeriod>('week');
  readonly goalError = signal('');

  private readonly index = computed(() => indexCompletions(this.completions()));
  readonly active = computed(() => this.habits().filter((habit) => habit.active));
  private readonly stats = computed(() => new Map(this.active().map((habit) => [habit.id, habitStats(habit, this.index(), this.today)])));

  readonly todayPct = computed(() => dayProgress(habitsForDay(this.active(), this.index(), new Date(), new Date())));
  readonly streaks = computed(() => perfectDayStreaks(this.active(), this.index(), this.today));
  readonly totals = computed(() => [...this.stats().values()].reduce(
    (sum, item) => ({ done: sum.done + item.total, missed: sum.missed + item.missed }),
    { done: 0, missed: 0 },
  ));
  readonly bars = computed(() => periodBars(this.active(), this.index(), this.period(), this.today));
  readonly periodName = computed(() => ({ week: 'This week', month: 'This month', year: 'This year' })[this.period()]);
  readonly periodCaption = computed(() => {
    const { from, to } = periodRange(this.period(), this.today);
    return `${formatMediumDate(from)} – ${formatMediumDate(to)}`;
  });
  readonly rows = computed(() => {
    const { from, to } = periodRange(this.period(), this.today);
    return this.active().map((habit) => {
      const value = percentOf(rangeTally(habit, this.index(), from, to, this.today));
      return { habit, stats: this.stats().get(habit.id)!, period: value === null ? '–' : `${value}%` };
    });
  });
  readonly goals = computed(() => this.allGoals().flatMap((goal) => {
    const habit = this.habits().find((item) => item.id === goal.habitId);
    return habit ? [{ ...goal, habit, ...goalProgress(goal, habit, this.index(), this.today) }] : [];
  }));
  readonly achievements = computed(() => {
    const unlocked = new Map(this.unlocked().map((item) => [item.id, item.unlockedAt]));
    return ACHIEVEMENTS.map((def) => {
      const at = unlocked.get(def.id);
      return { ...def, unlockedAt: at ? formatMediumDate(new Date(at)) : '' };
    });
  });
  readonly unlockedCount = computed(() => this.achievements().filter((item) => item.unlockedAt).length);

  pct(period: Period): string {
    const value = percentOf(periodTally(this.active(), this.index(), period, this.today));
    return value === null ? '–' : `${value}%`;
  }

  color(habit: Habit): string {
    return habitColor(habit);
  }

  textOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  numberOf(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  addGoal(): void {
    const habitId = this.goalHabit() || this.active()[0]?.id;
    if (!habitId) {
      this.goalError.set('Create a habit first.');
      return;
    }
    try {
      this.goalService.create(habitId, this.goalTarget(), this.goalPeriod());
      this.goalError.set('');
    } catch (error) {
      this.goalError.set(error instanceof Error ? error.message : 'The goal could not be saved.');
    }
  }

  removeGoal(id: number): void {
    this.goalService.remove(id);
  }
}
