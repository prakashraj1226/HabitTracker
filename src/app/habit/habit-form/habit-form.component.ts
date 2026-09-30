import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonButtonComponent } from '../../common/common-button/common-button.component';
import { EmptyStateComponent } from '../../common/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { IconComponent } from '../../common/icon/icon.component';
import {
  HABIT_CATEGORIES,
  HABIT_COLORS,
  HABIT_FREQUENCIES,
  HABIT_ICONS,
  WEEKDAY_OPTIONS,
} from '../../core/constants/habit.constants';
import { HabitDraft, HabitFrequency } from '../../core/models/habit.model';
import { HabitService } from '../../core/services/habit.service';
import { toDateKey } from '../../core/utils/date.util';

const customFrequencyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const frequency = control.get('frequency')?.value;
  const days = control.get('daysOfWeek')?.value as number[] | undefined;
  if (frequency === 'CUSTOM' && (!days || days.length === 0)) {
    return { customDays: true };
  }
  return null;
};

function nameValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return { required: true };
  }
  if (value.length < 2) {
    return { minlength: true };
  }
  if (value.length > 60) {
    return { maxlength: true };
  }
  return null;
}

@Component({
  selector: 'app-habit-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, CommonButtonComponent, EmptyStateComponent, IconComponent],
  templateUrl: './habit-form.component.html',
})
export class HabitFormComponent {
  private readonly habits = inject(HabitService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private saving = false;

  readonly categories = HABIT_CATEGORIES;
  readonly frequencies = HABIT_FREQUENCIES;
  readonly colors = HABIT_COLORS;
  readonly icons = HABIT_ICONS;
  readonly weekdays = WEEKDAY_OPTIONS;
  readonly submitted = signal(false);
  readonly missing = signal(false);
  readonly editing = signal(false);
  readonly habitId = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', nameValidator],
    description: ['', Validators.maxLength(240)],
    category: ['', Validators.required],
    frequency: ['DAILY' as HabitFrequency, Validators.required],
    startDate: [toDateKey(new Date()), Validators.required],
    reminderTime: [''],
    color: [HABIT_COLORS[0].value as string, Validators.required],
    icon: [HABIT_ICONS[0].id as string, Validators.required],
    active: [true],
    daysOfWeek: this.fb.nonNullable.control<number[]>([1, 2, 3, 4, 5]),
  }, { validators: customFrequencyValidator });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  get frequencyHint(): string {
    const frequency = this.form.controls.frequency.value;
    if (frequency === 'WEEKLY') {
      return 'Repeats each week on the weekday of the start date.';
    }
    if (frequency === 'CUSTOM') {
      return 'Choose the weekdays this habit should appear.';
    }
    return 'Scheduled every day from the start date.';
  }

  invalid(controlName: 'name' | 'description' | 'category' | 'startDate'): boolean {
    const control = this.form.controls[controlName];
    return (this.submitted() || control.touched) && control.invalid;
  }

  nameError(): string | null {
    const control = this.form.controls.name;
    if (!this.invalid('name')) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Enter a habit name.';
    }
    if (control.hasError('minlength')) {
      return 'Use at least 2 characters.';
    }
    return 'Keep the name under 60 characters.';
  }

  toggleDay(day: number): void {
    const current = this.form.controls.daysOfWeek.value;
    const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day];
    this.form.controls.daysOfWeek.setValue(next);
    this.form.controls.daysOfWeek.markAsTouched();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const draft = this.toDraft();
    this.saving = true;
    try {
      if (this.editing()) {
        const id = this.habitId();
        if (id === null) {
          throw new Error('That habit could not be found.');
        }
        this.habits.update(id, draft);
        void this.router.navigate(['/habits', id], { state: { notice: 'Habit updated.' } });
      } else {
        this.habits.create(draft);
        void this.router.navigate(['/habits'], { state: { notice: 'Habit created.' } });
      }
    } catch (error) {
      this.saving = false;
      this.error.set(error instanceof Error ? error.message : 'The habit could not be saved.');
    }
  }

  private load(): void {
    const editing = this.route.snapshot.routeConfig?.path === 'habits/:id/edit';
    this.editing.set(editing);
    this.submitted.set(false);
    this.error.set(null);
    if (!editing) {
      this.missing.set(false);
      this.habitId.set(null);
      this.form.reset({
        name: '',
        description: '',
        category: '',
        frequency: 'DAILY',
        startDate: toDateKey(new Date()),
        reminderTime: '',
        color: HABIT_COLORS[0].value,
        icon: HABIT_ICONS[0].id,
        active: true,
        daysOfWeek: [1, 2, 3, 4, 5],
      });
      return;
    }
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const habit = this.habits.getById(id);
    if (!habit) {
      this.missing.set(true);
      this.habitId.set(null);
      return;
    }
    this.missing.set(false);
    this.habitId.set(habit.id);
    this.form.reset({
      name: habit.name,
      description: habit.description ?? '',
      category: habit.category,
      frequency: habit.frequency,
      startDate: habit.startDate,
      reminderTime: habit.reminderTime ?? '',
      color: habit.color ?? HABIT_COLORS[0].value,
      icon: habit.icon ?? HABIT_ICONS[0].id,
      active: habit.active,
      daysOfWeek: habit.daysOfWeek?.length ? [...habit.daysOfWeek] : [1, 2, 3, 4, 5],
    });
  }

  private toDraft(): HabitDraft {
    const value = this.form.getRawValue();
    return {
      name: value.name,
      description: value.description,
      category: value.category,
      frequency: value.frequency,
      startDate: value.startDate,
      reminderTime: value.reminderTime,
      color: value.color,
      icon: value.icon,
      active: value.active,
      daysOfWeek: value.daysOfWeek,
    };
  }
}
