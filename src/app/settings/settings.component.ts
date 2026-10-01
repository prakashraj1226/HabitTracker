import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../common/icon/icon.component';
import { HabitService } from '../core/services/habit.service';
import { ReminderService } from '../core/services/reminder.service';
import { StorageService } from '../core/services/storage.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <a class="ht-back" routerLink="/habits" aria-label="Back"><app-icon name="chevronLeft" /></a>
        <h1 class="ht-title">Settings</h1>
      </header>

      <p class="ht-kicker">APP</p>
      <div class="ht-settings">
        <label class="ht-setting">
          <app-icon name="pencil" />
          <span>
            <strong>Display name</strong>
            <input class="ht-field" [value]="name()" (change)="saveName($event)" />
          </span>
        </label>
        <button type="button" class="ht-setting" (click)="allowReminders()">
          <app-icon name="bell" />
          <span>
            <strong>Reminders</strong>
            <small class="ht-muted">{{ reminderNote() }}</small>
          </span>
        </button>
      </div>

      <p class="ht-kicker">ARCHIVED HABITS</p>
      <div class="ht-settings">
        @for (habit of archived(); track habit.id) {
          <button type="button" class="ht-setting" (click)="habits.restore(habit.id)">
            <app-icon [name]="habit.icon || 'star'" />
            <span>
              <strong>{{ habit.name }}</strong>
              <small class="ht-muted">Tap to restore</small>
            </span>
          </button>
        } @empty {
          <p class="ht-muted">No archived habits.</p>
        }
      </div>
    </section>
  `,
})
export class SettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly reminders = inject(ReminderService);
  readonly habits = inject(HabitService);
  private readonly habitList = toSignal(this.habits.habits$, { initialValue: this.habits.getAll() });
  private readonly settings = toSignal(this.storage.settings$, { initialValue: { displayName: '' } });

  readonly name = signal(this.storage.get<{ displayName: string }>('habit-tracker.settings')?.displayName ?? '');
  readonly reminderNote = signal('Allow notifications for habit reminders');
  readonly archived = () => (this.habitList() ?? []).filter((habit) => habit.active === false);

  constructor() {
    this.name.set(this.settings()?.displayName ?? this.name());
  }

  saveName(event: Event): void {
    const displayName = (event.target as HTMLInputElement).value.trim().slice(0, 40);
    this.storage.saveSettings({ displayName });
    this.name.set(displayName);
  }

  async allowReminders(): Promise<void> {
    const allowed = await this.reminders.allow();
    this.reminderNote.set(allowed ? 'Notifications are allowed' : 'Notifications are blocked');
  }
}
