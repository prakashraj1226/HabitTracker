import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon/icon.component';
import { FREQUENCY_OPTIONS, HABIT_CATEGORIES, HABIT_COLORS, HABIT_ICONS, WEEKDAY_OPTIONS } from '../../core/constants/habit.constants';
import { Habit, HabitDraft, HabitFrequency, HabitIntent, HabitKind, HabitReminder, ReminderRepeat } from '../../core/models/habit.model';
import { HabitService, validateDraft } from '../../core/services/habit.service';
import { ReminderService } from '../../core/services/reminder.service';
import { isValidDateKey, toDateKey } from '../../core/utils/date.util';
import { formatClock, parseTime, toTimeValue } from '../../core/utils/habit-view.util';

const STEPS = 4;

@Component({
  selector: 'app-habit-wizard',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="ht-page ht-page--narrow">
      @if (step() === 0) {
        <a class="ht-back" [routerLink]="closeLink" aria-label="Close"><app-icon name="close" /></a>
      } @else {
        <button type="button" class="ht-back" aria-label="Back" (click)="back()"><app-icon name="chevronLeft" /></button>
      }
      <div class="ht-progress" aria-hidden="true">
        @for (bar of stepBars; track bar) { <span [class.is-on]="bar <= step()"></span> }
      </div>

      @if (step() === 0) {
        <h1 class="ht-h1">{{ editing ? 'Edit habit' : 'What kind of habit?' }}</h1>
        <button type="button" class="ht-choice" [class.is-on]="kind() === 'tick'" (click)="kind.set('tick')">
          <span class="ht-badge" style="background: var(--accent-soft); color: var(--accent)"><app-icon name="check" /></span>
          <span><strong>Tick</strong><small>Track yes or no per day</small></span>
        </button>
        @if (kind() === 'tick') {
          <div class="ht-split">
            <button type="button" class="ht-choice" [class.is-on]="intent() === 'build'" (click)="intent.set('build')">
              <span><strong>Build a habit</strong><small>Add a positive routine.</small></span>
            </button>
            <button type="button" class="ht-choice" [class.is-on]="intent() === 'quit'" (click)="intent.set('quit')">
              <span><strong>Quit a habit</strong><small>Tick the days you stayed away.</small></span>
            </button>
          </div>
        }
        <button type="button" class="ht-choice" [class.is-on]="kind() === 'measurable'" (click)="kind.set('measurable')">
          <span class="ht-badge" style="background: var(--card-2); color: var(--tick)"><app-icon name="activity" /></span>
          <span><strong>Measurable</strong><small>Track numbers: glasses, pages, minutes…</small></span>
        </button>
      }

      @if (step() === 1) {
        <h1 class="ht-h1">Name your habit</h1>
        <div class="ht-hero" [style.color]="color()"><app-icon [name]="icon()" /></div>
        <input class="ht-input" [class.is-bad]="showError() && nameProblem()" [value]="name()" maxlength="60"
               placeholder="e.g. Morning run, Read books" aria-label="Habit name" (input)="name.set(value($event))" />
        <p class="ht-label">Description <span class="ht-muted ht-small">(optional)</span></p>
        <textarea class="ht-field" rows="2" maxlength="240" [value]="description()" placeholder="Why does this habit matter?"
                  (input)="description.set(value($event))"></textarea>
        <p class="ht-label">Icon</p>
        <div class="ht-icons">
          @for (item of icons; track item) {
            <button type="button" [class.is-on]="icon() === item" [attr.aria-label]="item" (click)="icon.set(item)"><app-icon [name]="item" /></button>
          }
        </div>
        <p class="ht-label">Color</p>
        <div class="ht-colors">
          @for (item of colors; track item) {
            <button type="button" [class.is-on]="color() === item" [attr.aria-label]="'Color ' + item" (click)="color.set(item)">
              <span class="ht-swatch" [style.background]="item"></span>
            </button>
          }
        </div>
      }

      @if (step() === 2) {
        <h1 class="ht-h1">How often?</h1>
        <div class="ht-pills" role="radiogroup" aria-label="Frequency">
          @for (item of frequencies; track item.value) {
            <button type="button" role="radio" [attr.aria-checked]="frequency() === item.value" [class.is-on]="frequency() === item.value"
                    (click)="frequency.set(item.value)">{{ item.label }}</button>
          }
        </div>

        @switch (frequency()) {
          @case ('CUSTOM') {
            <p class="ht-label">On these days</p>
            <div class="ht-pills">
              @for (day of weekdays; track day.value) {
                <button type="button" [class.is-on]="days().includes(day.value)" [attr.aria-pressed]="days().includes(day.value)" (click)="toggleDay(day.value)">{{ day.label }}</button>
              }
            </div>
          }
          @case ('WEEKLY') {
            <p class="ht-label">Times per week</p>
            <div class="ht-number">
              <input class="ht-field" type="number" min="1" max="7" [value]="timesPerWeek()" (input)="timesPerWeek.set(number($event))" aria-label="Times per week" />
              <span class="ht-muted">any days you like</span>
            </div>
          }
          @case ('MONTHLY') {
            <p class="ht-label">Day of the month</p>
            <div class="ht-number">
              <input class="ht-field" type="number" min="1" max="31" [value]="dayOfMonth()" (input)="dayOfMonth.set(number($event))" aria-label="Day of month" />
              <span class="ht-muted">short months use their last day</span>
            </div>
          }
        }

        <p class="ht-label">{{ kind() === 'measurable' ? 'Daily target' : 'Times per day' }}</p>
        <div class="ht-number">
          <input class="ht-field" type="number" min="1" max="999" [value]="target()" (input)="target.set(number($event))" aria-label="Daily target" />
          @if (kind() === 'measurable') {
            <input class="ht-field" style="width: 160px" maxlength="20" [value]="unit()" placeholder="glasses" aria-label="Unit" (input)="unit.set(value($event))" />
          }
        </div>

        <p class="ht-label">Category</p>
        <div class="ht-pills">
          @for (item of categories; track item) {
            <button type="button" [class.is-on]="!customCategory() && category() === item" (click)="pickCategory(item)">{{ item }}</button>
          }
          <button type="button" [class.is-on]="customCategory()" (click)="customCategory.set(true)">+ Custom</button>
        </div>
        @if (customCategory()) {
          <input class="ht-field" maxlength="24" [value]="category()" placeholder="Category name" aria-label="Custom category" (input)="category.set(value($event))" />
        }

        <p class="ht-label">Start date</p>
        <input class="ht-field" type="date" [value]="startDate()" (input)="startDate.set(value($event))" aria-label="Start date" />
      }

      @if (step() === 3) {
        <div class="ht-row">
          <h1 class="ht-h1" style="margin: 0">Reminders</h1>
          <button type="button" class="ht-switch" [class.is-on]="remindersOn()" [attr.aria-pressed]="remindersOn()" aria-label="Turn reminders on or off"
                  (click)="toggleReminders()"><i></i></button>
        </div>
        <p class="ht-muted" style="margin-top: 8px">People who set reminders are more likely to stick with their habits.</p>

        @if (remindersOn()) {
          <div class="ht-reminders">
            @for (reminder of reminders(); track reminder.id; let i = $index) {
              <button type="button" [class.is-on]="selected() === i" [class.is-off]="!reminder.enabled" (click)="selected.set(i)">
                <app-icon name="bell" /> {{ clock(reminder.time) }}
              </button>
            }
            @if (reminders().length < 5) {
              <button type="button" (click)="addReminder()"><app-icon name="plus" /> Add</button>
            }
          </div>

          @if (current(); as reminder) {
            <div class="ht-clock">
              <ul aria-label="Hour">
                @for (hour of hours; track hour) {
                  <li><button type="button" [class.is-on]="clockParts().hour === hour" (click)="setClock(hour, null, null)">{{ pad(hour) }}</button></li>
                }
              </ul>
              <ul aria-label="Minute">
                @for (minute of minutes; track minute) {
                  <li><button type="button" [class.is-on]="clockParts().minute === minute" (click)="setClock(null, minute, null)">{{ pad(minute) }}</button></li>
                }
              </ul>
              <ul aria-label="AM or PM">
                <li><button type="button" [class.is-on]="clockParts().meridiem === 'AM'" (click)="setClock(null, null, 'AM')">AM</button></li>
                <li><button type="button" [class.is-on]="clockParts().meridiem === 'PM'" (click)="setClock(null, null, 'PM')">PM</button></li>
              </ul>
            </div>

            <p class="ht-label">Message</p>
            <input class="ht-field" maxlength="80" [value]="reminder.message" placeholder="Time to tick this habit."
                   aria-label="Reminder message" (input)="patchReminder({ message: value($event) })" />

            <p class="ht-label">Repeat</p>
            <div class="ht-pills">
              <button type="button" [class.is-on]="reminder.repeat === 'daily'" (click)="patchReminder({ repeat: 'daily' })">Every day</button>
              <button type="button" [class.is-on]="reminder.repeat === 'scheduled'" (click)="patchReminder({ repeat: 'scheduled' })">Only on habit days</button>
            </div>

            <div class="ht-row" style="margin-top: 16px">
              <label class="ht-row" style="justify-content: flex-start">
                <button type="button" class="ht-switch" [class.is-on]="reminder.enabled" [attr.aria-pressed]="reminder.enabled" aria-label="Enable this reminder"
                        (click)="patchReminder({ enabled: !reminder.enabled })"><i></i></button>
                <span>{{ reminder.enabled ? 'Enabled' : 'Disabled' }}</span>
              </label>
              <button type="button" class="btn btn--danger-ghost btn--sm" (click)="removeReminder()"><app-icon name="trash" /> Remove</button>
            </div>
          }
        }
      }

      @if (showError() && stepError()) {
        <p class="ht-error" role="alert">{{ stepError() }}</p>
      }

      <button type="button" class="ht-save" (click)="next()">
        {{ step() === lastStep ? (editing ? 'Save changes' : 'Save habit') : 'Continue' }}
      </button>
    </section>
  `,
})
export class HabitWizardComponent {
  private readonly habits = inject(HabitService);
  private readonly reminderService = inject(ReminderService);
  private readonly router = inject(Router);
  private readonly existing: Habit | undefined;

  readonly editing: boolean;
  readonly closeLink: string;
  readonly lastStep = STEPS - 1;
  readonly stepBars = Array.from({ length: STEPS }, (_, index) => index);
  readonly icons = HABIT_ICONS;
  readonly colors = HABIT_COLORS;
  readonly categories = HABIT_CATEGORIES;
  readonly frequencies = FREQUENCY_OPTIONS;
  readonly weekdays = WEEKDAY_OPTIONS;
  readonly hours = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutes = Array.from({ length: 12 }, (_, index) => index * 5);

  readonly step = signal(0);
  readonly showError = signal(false);
  readonly kind = signal<HabitKind | null>(null);
  readonly intent = signal<HabitIntent>('build');
  readonly name = signal('');
  readonly description = signal('');
  readonly icon = signal('star');
  readonly color = signal(HABIT_COLORS[5]);
  readonly frequency = signal<HabitFrequency>('DAILY');
  readonly days = signal<number[]>([1, 2, 3, 4, 5]);
  readonly timesPerWeek = signal(3);
  readonly dayOfMonth = signal(new Date().getDate());
  readonly target = signal(1);
  readonly unit = signal('');
  readonly category = signal('Health');
  readonly customCategory = signal(false);
  readonly startDate = signal(toDateKey(new Date()));
  readonly remindersOn = signal(false);
  readonly reminders = signal<HabitReminder[]>([]);
  readonly selected = signal(0);
  readonly saveError = signal('');

  readonly current = computed(() => this.reminders()[this.selected()] ?? null);
  readonly clockParts = computed(() => parseTime(this.current()?.time ?? '09:00'));
  readonly nameProblem = computed(() => {
    const length = this.name().trim().length;
    return length < 2 || length > 60;
  });
  readonly stepError = computed(() => this.errorFor(this.step()) || (this.step() === this.lastStep ? this.saveError() : ''));

  constructor() {
    const id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
    this.existing = Number.isFinite(id) ? this.habits.getById(id) : undefined;
    this.editing = !!this.existing;
    this.closeLink = this.existing ? `/habits/${this.existing.id}` : '/habits';
    const habit = this.existing;
    if (!habit) {
      return;
    }
    this.kind.set(habit.kind ?? 'tick');
    this.intent.set(habit.intent ?? 'build');
    this.name.set(habit.name);
    this.description.set(habit.description ?? '');
    this.icon.set(habit.icon || 'star');
    this.color.set(habit.color || HABIT_COLORS[5]);
    this.frequency.set(habit.frequency);
    this.days.set(habit.daysOfWeek?.length ? habit.daysOfWeek : [1, 2, 3, 4, 5]);
    this.timesPerWeek.set(habit.timesPerWeek ?? 3);
    this.dayOfMonth.set(habit.dayOfMonth ?? 1);
    this.target.set(habit.target ?? 1);
    this.unit.set(habit.unit ?? '');
    this.category.set(habit.category);
    this.customCategory.set(!HABIT_CATEGORIES.includes(habit.category));
    this.startDate.set(habit.startDate);
    this.reminders.set(structuredClone(habit.reminders ?? []));
    this.remindersOn.set((habit.reminders ?? []).length > 0);
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  number(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  clock(time: string): string {
    return formatClock(time);
  }

  toggleDay(day: number): void {
    this.days.update((days) => (days.includes(day) ? days.filter((item) => item !== day) : [...days, day]));
  }

  pickCategory(item: string): void {
    this.customCategory.set(false);
    this.category.set(item);
  }

  toggleReminders(): void {
    const on = !this.remindersOn();
    this.remindersOn.set(on);
    if (on && !this.reminders().length) {
      this.addReminder();
    }
  }

  addReminder(): void {
    const list = this.reminders();
    const id = Math.max(0, ...list.map((item) => item.id)) + 1;
    const time = list.length ? '20:00' : '09:00';
    this.reminders.set([...list, { id, time, enabled: true, message: '', repeat: 'daily' }]);
    this.selected.set(list.length);
  }

  removeReminder(): void {
    const list = this.reminders().filter((_, index) => index !== this.selected());
    this.reminders.set(list);
    this.selected.set(Math.max(0, this.selected() - 1));
    if (!list.length) {
      this.remindersOn.set(false);
    }
  }

  patchReminder(change: Partial<HabitReminder> & { repeat?: ReminderRepeat }): void {
    const index = this.selected();
    this.reminders.update((list) => list.map((item, position) => (position === index ? { ...item, ...change } : item)));
  }

  setClock(hour: number | null, minute: number | null, meridiem: 'AM' | 'PM' | null): void {
    const parts = this.clockParts();
    this.patchReminder({ time: toTimeValue(hour ?? parts.hour, minute ?? parts.minute, meridiem ?? parts.meridiem) });
  }

  back(): void {
    this.showError.set(false);
    this.step.update((value) => Math.max(0, value - 1));
  }

  next(): void {
    if (this.errorFor(this.step())) {
      this.showError.set(true);
      return;
    }
    this.showError.set(false);
    if (this.step() < this.lastStep) {
      this.step.update((value) => value + 1);
      return;
    }
    this.save();
  }

  private errorFor(step: number): string {
    if (step === 0 && !this.kind()) {
      return 'Choose a habit type.';
    }
    if (step === 1) {
      if (this.nameProblem()) {
        return 'Enter a habit name between 2 and 60 characters.';
      }
      if (this.description().trim().length > 240) {
        return 'Keep the description under 240 characters.';
      }
    }
    if (step === 2) {
      if (this.frequency() === 'CUSTOM' && !this.days().length) {
        return 'Pick at least one day of the week.';
      }
      if (this.frequency() === 'WEEKLY' && !(this.timesPerWeek() >= 1 && this.timesPerWeek() <= 7)) {
        return 'Times per week must be between 1 and 7.';
      }
      if (this.frequency() === 'MONTHLY' && !(this.dayOfMonth() >= 1 && this.dayOfMonth() <= 31)) {
        return 'Day of the month must be between 1 and 31.';
      }
      if (!(this.target() >= 1 && this.target() <= 999 && Number.isInteger(this.target()))) {
        return 'Enter a whole number between 1 and 999.';
      }
      if (this.kind() === 'measurable' && !this.unit().trim()) {
        return 'Enter a unit such as glasses, pages or minutes.';
      }
      const category = this.category().trim();
      if (category.length < 2 || category.length > 24) {
        return 'Choose a category (2–24 characters).';
      }
      if (!isValidDateKey(this.startDate())) {
        return 'Choose a valid start date.';
      }
    }
    return '';
  }

  private draft(): HabitDraft {
    return {
      name: this.name(),
      description: this.description(),
      category: this.category(),
      frequency: this.frequency(),
      startDate: this.startDate(),
      active: this.existing?.active ?? true,
      kind: this.kind() ?? 'tick',
      intent: this.intent(),
      icon: this.icon(),
      color: this.color(),
      daysOfWeek: this.days(),
      timesPerWeek: this.timesPerWeek(),
      dayOfMonth: this.dayOfMonth(),
      unit: this.unit(),
      target: this.target(),
      reminders: this.remindersOn() ? this.reminders() : [],
    };
  }

  private save(): void {
    const draft = this.draft();
    const problem = validateDraft(draft);
    if (problem) {
      this.saveError.set(problem);
      this.showError.set(true);
      return;
    }
    let saved: Habit;
    try {
      saved = this.existing ? this.habits.update(this.existing.id, draft) : this.habits.create(draft);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'The habit could not be saved.');
      this.showError.set(true);
      return;
    }
    if (draft.reminders?.some((item) => item.enabled)) {
      void this.reminderService.allow();
    }
    void this.router.navigate(this.existing ? ['/habits', saved.id] : ['/habits']);
  }
}
