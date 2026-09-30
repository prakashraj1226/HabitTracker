import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, take } from 'rxjs';
import { CommonButtonComponent } from '../common/common-button/common-button.component';
import { CommonCardComponent } from '../common/common-card/common-card.component';
import { ConfirmationDialogComponent } from '../common/confirmation-dialog/confirmation-dialog.component';
import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { STORAGE_KEYS } from '../core/constants/habit.constants';
import { HabitCompletionService } from '../core/services/habit-completion.service';
import { HabitService } from '../core/services/habit.service';
import { StorageService } from '../core/services/storage.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, PageHeaderComponent, CommonCardComponent, CommonButtonComponent, ConfirmationDialogComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly habits = inject(HabitService);
  private readonly completions = inject(HabitCompletionService);
  private readonly fb = inject(FormBuilder);

  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly confirmClear = signal(false);
  readonly form = this.fb.nonNullable.group({
    displayName: ['', Validators.maxLength(40)],
  });

  readonly counts = toSignal(
    combineLatest([this.habits.habits$, this.completions.completions$]).pipe(
      map(([habits, completions]) => ({ habits: habits.length, completions: completions.length })),
    ),
    { initialValue: { habits: 0, completions: 0 } },
  );

  constructor() {
    this.storage.settings$.pipe(take(1), takeUntilDestroyed()).subscribe((settings) => {
      this.form.patchValue({ displayName: settings.displayName });
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.storage.saveSettings({ displayName: this.form.controls.displayName.value });
      this.notice.set('Settings saved.');
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Settings could not be saved.');
    }
  }

  clearData(): void {
    try {
      this.habits.replaceAll([]);
      this.completions.replaceAll([]);
      this.storage.set(STORAGE_KEYS.meta, { seeded: true });
      this.confirmClear.set(false);
      this.notice.set('All habits and history were removed.');
      this.error.set(null);
    } catch (error) {
      this.confirmClear.set(false);
      this.error.set(error instanceof Error ? error.message : 'Stored data could not be cleared.');
    }
  }
}
