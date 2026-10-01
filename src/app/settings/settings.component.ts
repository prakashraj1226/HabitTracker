import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../common/icon/icon.component';
import { ThemeMode } from '../core/models/settings.model';
import { HabitService } from '../core/services/habit.service';
import { ReminderService } from '../core/services/reminder.service';
import { StorageService } from '../core/services/storage.service';

const PERMISSION_TEXT = {
  granted: 'Notifications are allowed',
  denied: 'Notifications are blocked. Allow them in your browser or phone settings.',
  prompt: 'Tap to allow notifications for habit reminders',
  unsupported: 'This browser does not support notifications',
} as const;

@Component({
  selector: 'app-settings',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="ht-page ht-page--narrow">
      <header class="ht-top">
        <a class="ht-back" routerLink="/today" aria-label="Back"><app-icon name="chevronLeft" /></a>
        <h1 class="ht-title">Settings</h1>
      </header>

      <p class="ht-kicker">PROFILE</p>
      <div class="ht-settings">
        <label class="ht-setting">
          <app-icon name="pencil" />
          <span>
            <strong>Display name</strong>
            <small class="ht-muted">Used in the greeting on the Today screen.</small>
            <input class="ht-field" maxlength="40" [value]="settings().displayName" placeholder="Your name" (change)="saveName($event)" />
          </span>
        </label>
      </div>

      <p class="ht-kicker">APPEARANCE</p>
      <div class="ht-settings">
        <div class="ht-setting">
          <app-icon [name]="settings().theme === 'light' ? 'sun' : 'moon'" />
          <span>
            <strong>Theme</strong>
            <div class="ht-pills" style="margin-top: 6px">
              @for (item of themes; track item.id) {
                <button type="button" [class.is-on]="settings().theme === item.id" (click)="setTheme(item.id)">{{ item.label }}</button>
              }
            </div>
          </span>
        </div>
      </div>

      <p class="ht-kicker">REMINDERS</p>
      <div class="ht-settings">
        <button type="button" class="ht-setting" (click)="allowReminders()">
          <app-icon name="bell" />
          <span>
            <strong>Notifications</strong>
            <small class="ht-muted">{{ permissionText() }}</small>
          </span>
        </button>
      </div>

      <p class="ht-kicker">ARCHIVED HABITS</p>
      <div class="ht-settings">
        @for (habit of archived(); track habit.id) {
          <div class="ht-setting">
            <app-icon [name]="habit.icon || 'star'" />
            <span><strong>{{ habit.name }}</strong><small class="ht-muted">{{ habit.category }}</small></span>
            <button type="button" class="btn btn--secondary btn--sm" (click)="habits.restore(habit.id)">Restore</button>
          </div>
        } @empty {
          <p class="ht-muted">No archived habits.</p>
        }
      </div>

      <p class="ht-kicker">DATA</p>
      <p class="ht-muted ht-small">
        Everything is saved on this device: in <code>data/tracker.json</code> on the computer, and inside the app on your phone.
      </p>
    </section>
  `,
})
export class SettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly reminders = inject(ReminderService);
  readonly habits = inject(HabitService);
  private readonly habitList = toSignal(this.habits.habits$, { initialValue: this.habits.getAll() });
  readonly settings = toSignal(this.storage.settings$, { requireSync: true });
  readonly permission = signal<keyof typeof PERMISSION_TEXT>('prompt');

  readonly themes: { id: ThemeMode; label: string }[] = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'system', label: 'System' },
  ];
  readonly archived = computed(() => this.habitList().filter((habit) => !habit.active));
  readonly permissionText = computed(() => PERMISSION_TEXT[this.permission()]);

  constructor() {
    void this.reminders.permission().then((value) => this.permission.set(value));
  }

  saveName(event: Event): void {
    this.storage.saveSettings({ displayName: (event.target as HTMLInputElement).value });
  }

  setTheme(theme: ThemeMode): void {
    this.storage.saveSettings({ theme });
  }

  async allowReminders(): Promise<void> {
    await this.reminders.allow();
    this.permission.set(await this.reminders.permission());
  }
}
