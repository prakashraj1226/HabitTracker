import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon/icon.component';
import { HabitDraft, HabitIntent, HabitKind, HabitRepeat } from '../../core/models/habit.model';
import { HabitService } from '../../core/services/habit.service';
import { ReminderService } from '../../core/services/reminder.service';
import { toDateKey } from '../../core/utils/date.util';
import { parseTime, toTimeValue } from '../../core/utils/habit-view.util';

const ICONS = ['heart', 'book', 'gym', 'run', 'food', 'music', 'droplet', 'star', 'sun', 'moon', 'coffee', 'target'];
const COLORS = ['#f28b82', '#f6ad7b', '#7eb6ff', '#9b8cff', '#c084fc', '#3ddc97', '#5eead4', '#f0a48a'];
const CATEGORIES = ['Art', 'Finances', 'Fitness', 'Health', 'Nutrition', 'Social', 'Study', 'Work', 'Morning', 'Day', 'Evening', 'Other'];

@Component({
  selector: 'app-habit-wizard',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="ht-page">
      @if (step() === 0) {
        <a class="ht-back" routerLink="/habits" aria-label="Close"><app-icon name="close" /></a>
      } @else {
        <button type="button" class="ht-back" aria-label="Back" (click)="back()"><app-icon name="chevronLeft" /></button>
      }
      <div class="ht-progress" aria-hidden="true">
        @for (bar of [0, 1, 2, 3]; track bar) {
          <span [class.is-on]="bar <= step()"></span>
        }
      </div>

      @if (step() === 0) {
        <h1 class="ht-h1">What kind of habit?</h1>
        <button type="button" class="ht-choice" [class.is-on]="kind() === 'tick'" (click)="kind.set('tick')">
          <span class="ht-badge" style="background:#163528;color:#3ddc97"><app-icon name="check" /></span>
          <span><strong>Tick</strong><small>Track yes or no per day</small></span>
        </button>
        @if (kind() === 'tick') {
          <div class="ht-split">
            <button type="button" class="ht-choice" [class.is-on]="intent() === 'build'" (click)="intent.set('build')">
              <span><strong>Build a Habit</strong><small>Add a positive routine.</small></span>
            </button>
            <button type="button" class="ht-choice" [class.is-on]="intent() === 'quit'" (click)="intent.set('quit')">
              <span><strong>Quit a Habit</strong><small>Count the days you skip it.</small></span>
            </button>
          </div>
          <p class="ht-note">{{ intent() === 'quit' ? 'Each tick means you stayed away from it today.' : 'Add a new positive routine. Daily completions build your streak.' }}</p>
        }
        <button type="button" class="ht-choice" [class.is-on]="kind() === 'measurable'" (click)="kind.set('measurable')">
          <span class="ht-badge" style="background:#172554;color:#7eb6ff"><app-icon name="activity" /></span>
          <span><strong>Measurable</strong><small>Track numbers, distance, or time</small></span>
        </button>
      }

      @if (step() === 1) {
        <h1 class="ht-h1">Name Your Habit</h1>
        <div class="ht-hero"><app-icon [name]="icon()" /></div>
        <input class="ht-input" [class.is-bad]="nameError()" [value]="name()" placeholder="e.g., Morning Run, Read Books" (input)="onName($event)" />
        @if (nameError()) {
          <p class="ht-error">Please enter a habit name</p>
        }
        <p class="ht-label">Select Icon</p>
        <div class="ht-icons">
          @for (item of icons; track item) {
            <button type="button" [class.is-on]="icon() === item" [attr.aria-label]="item" (click)="icon.set(item)">
              <app-icon [name]="item" />
            </button>
          }
        </div>
        <p class="ht-label">Select Color</p>
        <div class="ht-colors">
          @for (item of colors; track item) {
            <button type="button" [class.is-on]="color() === item" [attr.aria-label]="item" (click)="color.set(item)">
              <span class="ht-swatch" [style.background]="item"></span>
            </button>
          }
        </div>
      }

      @if (step() === 2) {
        <h1 class="ht-h1">How do you track it?</h1>
        <p class="ht-label">Repeat Goal</p>
        <div class="ht-pills">
          <button type="button" [class.is-on]="repeat() === 'once'" (click)="repeat.set('once')">Once a Day</button>
          <button type="button" [class.is-on]="repeat() === 'multiple'" (click)="repeat.set('multiple')">Multiple per Day</button>
          <button type="button" [class.is-on]="repeat() === 'weekly'" (click)="repeat.set('weekly')">Weekly Goal</button>
        </div>
        @if (kind() === 'measurable' || repeat() === 'multiple') {
          <p class="ht-label">{{ kind() === 'measurable' ? 'Daily target' : 'Times per day' }}</p>
          <input class="ht-field" type="number" min="1" max="99" [value]="target()" (input)="onTarget($event)" />
        }
        @if (kind() === 'measurable') {
          <p class="ht-label">Unit</p>
          <input class="ht-field" [value]="unit()" placeholder="glasses" (input)="onUnit($event)" />
        }
        <p class="ht-label">Categories</p>
        <div class="ht-pills">
          @for (item of categories; track item) {
            <button type="button" [class.is-on]="category() === item" (click)="category.set(item)">{{ item }}</button>
          }
          <button type="button" [class.is-on]="customCategory()" (click)="customCategory.set(true)">+ Custom</button>
        </div>
        @if (customCategory()) {
          <input class="ht-field" [value]="category()" placeholder="Category name" (input)="onCategory($event)" />
        }
      }

      @if (step() === 3) {
        <div class="ht-row">
          <h1 class="ht-h1">Set a Daily Reminder</h1>
          <button type="button" class="ht-switch" [class.is-on]="reminderOn()" [attr.aria-pressed]="reminderOn()" aria-label="Toggle reminder" (click)="reminderOn.set(!reminderOn())">
            <i></i>
          </button>
        </div>
        <p class="ht-muted">People who set reminders are more likely to stick with their habits.</p>
        @if (reminderOn()) {
          <div class="ht-clock">
            <ul>
              @for (hour of hours; track hour) {
                <li><button type="button" [class.is-on]="clockHour() === hour" (click)="clockHour.set(hour)">{{ pad(hour) }}</button></li>
              }
            </ul>
            <ul>
              @for (minute of minutes; track minute) {
                <li><button type="button" [class.is-on]="clockMinute() === minute" (click)="clockMinute.set(minute)">{{ pad(minute) }}</button></li>
              }
            </ul>
            <ul>
              <li><button type="button" [class.is-on]="meridiem() === 'AM'" (click)="meridiem.set('AM')">AM</button></li>
              <li><button type="button" [class.is-on]="meridiem() === 'PM'" (click)="meridiem.set('PM')">PM</button></li>
            </ul>
          </div>
        }
        <p class="ht-muted" style="margin-top:18px">More reminders can be changed later from the habit settings.</p>
        @if (saveError()) {
          <p class="ht-error">{{ saveError() }}</p>
        }
      }

      <button type="button" class="ht-save" [disabled]="!canContinue()" (click)="next()">
        {{ step() === 3 ? 'Save Habit' : 'Continue' }}
      </button>
    </section>
  `,
})
export class HabitWizardComponent {
  private readonly habits = inject(HabitService);
  private readonly reminders = inject(ReminderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly editingId = Number(this.route.snapshot.paramMap.get('id'));

  readonly icons = ICONS;
  readonly colors = COLORS;
  readonly categories = CATEGORIES;
  readonly hours = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  readonly step = signal(0);
  readonly kind = signal<HabitKind | null>(null);
  readonly intent = signal<HabitIntent>('build');
  readonly name = signal('');
  readonly nameError = signal(false);
  readonly icon = signal('star');
  readonly color = signal(COLORS[5]);
  readonly repeat = signal<HabitRepeat>('once');
  readonly target = signal(1);
  readonly unit = signal('glasses');
  readonly category = signal('Fitness');
  readonly customCategory = signal(false);
  readonly reminderOn = signal(false);
  readonly clockHour = signal(9);
  readonly clockMinute = signal(0);
  readonly meridiem = signal<'AM' | 'PM'>('AM');
  readonly saveError = signal('');

  constructor() {
    const existing = Number.isFinite(this.editingId) ? this.habits.getById(this.editingId) : undefined;
    if (!existing) {
      return;
    }
    const clock = parseTime(existing.reminderTime || '09:00');
    this.kind.set(existing.kind === 'measurable' ? 'measurable' : 'tick');
    this.intent.set(existing.intent === 'quit' ? 'quit' : 'build');
    this.name.set(existing.name);
    this.icon.set(existing.icon || 'star');
    this.color.set(existing.color || COLORS[5]);
    this.repeat.set(existing.repeat || (existing.frequency === 'WEEKLY' ? 'weekly' : 'once'));
    this.target.set(existing.target || 1);
    this.unit.set(existing.unit || 'glasses');
    this.category.set(existing.category || 'Other');
    this.customCategory.set(!CATEGORIES.includes(existing.category));
    this.reminderOn.set(Boolean(existing.reminderEnabled && existing.reminderTime));
    this.clockHour.set(clock.hour);
    this.clockMinute.set(this.minutes.reduce((nearest, minute) => Math.abs(minute - clock.minute) < Math.abs(nearest - clock.minute) ? minute : nearest, 0));
    this.meridiem.set(clock.meridiem);
  }

  pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  canContinue(): boolean {
    if (this.step() === 0) {
      return this.kind() !== null;
    }
    if (this.step() === 1) {
      return this.name().trim().length >= 2;
    }
    if (this.step() === 2) {
      return this.category().trim().length >= 2 && (this.kind() !== 'measurable' || this.unit().trim().length > 0);
    }
    return true;
  }

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.nameError.set(false);
  }

  onTarget(event: Event): void {
    this.target.set(Number((event.target as HTMLInputElement).value));
  }

  onUnit(event: Event): void {
    this.unit.set((event.target as HTMLInputElement).value);
  }

  onCategory(event: Event): void {
    this.category.set((event.target as HTMLInputElement).value);
  }

  back(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  next(): void {
    if (!this.canContinue()) {
      if (this.step() === 1) {
        this.nameError.set(true);
      }
      return;
    }
    if (this.step() < 3) {
      this.step.update((value) => value + 1);
      return;
    }
    this.save();
  }

  private save(): void {
    const reminder = toTimeValue(this.clockHour(), this.clockMinute(), this.meridiem());
    const draft: HabitDraft = {
      name: this.name(),
      category: this.category().trim(),
      frequency: this.repeat() === 'weekly' ? 'WEEKLY' : 'DAILY',
      startDate: toDateKey(new Date()),
      active: true,
      kind: this.kind() ?? 'tick',
      intent: this.kind() === 'tick' ? this.intent() : 'build',
      repeat: this.repeat(),
      icon: this.icon(),
      color: this.color(),
      unit: this.unit(),
      target: this.target(),
      reminderEnabled: this.reminderOn(),
      reminderTime: reminder,
    };
    try {
      if (Number.isFinite(this.editingId) && this.habits.getById(this.editingId)) {
        const existing = this.habits.getById(this.editingId);
        this.habits.update(this.editingId, { ...draft, startDate: existing?.startDate || draft.startDate, active: existing?.active ?? true });
      } else {
        this.habits.create(draft);
      }
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'The habit could not be saved.');
      return;
    }
    if (this.reminderOn()) {
      void this.reminders.allow();
    }
    void this.router.navigateByUrl('/habits');
  }
}
