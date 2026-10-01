import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ConfirmationDialogComponent } from '../common/confirmation-dialog/confirmation-dialog.component';
import { IconComponent } from '../common/icon/icon.component';
import { ThemeMode } from '../core/models/settings.model';
import { AuthService } from '../core/services/auth.service';
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
  imports: [RouterLink, IconComponent, ConfirmationDialogComponent],
  template: `
    <section class="ht-page ht-page--narrow">
      <header class="ht-top">
        <a class="ht-back" routerLink="/today" aria-label="Back"><app-icon name="chevronLeft" /></a>
        <h1 class="ht-title">Settings</h1>
      </header>

      <p class="ht-kicker">ACCOUNT</p>
      <div class="ht-settings">
        <label class="ht-setting">
          <app-icon name="pencil" />
          <span>
            <strong>Name</strong>
            <small class="ht-muted">Signed in as &#64;{{ account()?.username }}. Your name is used in the Today greeting.</small>
            <input class="ht-field" maxlength="40" [value]="account()?.name ?? ''" placeholder="Your name" (change)="saveName($event)" />
          </span>
        </label>

        @if (fingerprintSupported()) {
          <div class="ht-setting">
            <app-icon name="target" />
            <span>
              <strong>Unlock with fingerprint</strong>
              <small class="ht-muted">Anyone whose fingerprint is saved on this phone can unlock this account.</small>
            </span>
            <button type="button" class="ht-switch" [class.is-on]="account()?.biometric" [attr.aria-pressed]="account()?.biometric"
                    aria-label="Fingerprint unlock" [disabled]="busy()" (click)="toggleFingerprint()"><i></i></button>
          </div>
        }

        <div class="ht-setting">
          <app-icon name="settings" />
          <span>
            <strong>Change password</strong>
            <input class="ht-field" type="password" autocomplete="current-password" placeholder="Current password" [value]="currentPassword()" (input)="currentPassword.set(text($event))" />
            <input class="ht-field" type="password" autocomplete="new-password" placeholder="New password (6+ characters)" [value]="newPassword()" (input)="newPassword.set(text($event))" />
            <input class="ht-field" type="password" autocomplete="new-password" placeholder="Confirm new password" [value]="confirmPassword()" (input)="confirmPassword.set(text($event))" />
            <div class="ht-row" style="margin-top: 8px; justify-content: flex-start; flex-wrap: wrap">
              <button type="button" class="btn btn--primary btn--sm" [disabled]="busy()" (click)="changePassword()">Change password</button>
              <button type="button" class="btn btn--secondary btn--sm" [disabled]="busy()" (click)="newRecoveryCode()">New recovery code</button>
            </div>
            @if (recoveryCode()) {
              <div class="ht-code" style="font-size: 18px">{{ recoveryCode() }}</div>
              <small class="ht-muted">Save this code now. Your old code no longer works.</small>
            }
            @if (accountMessage()) { <small [class.ht-error]="accountError()" [class.ht-muted]="!accountError()">{{ accountMessage() }}</small> }
          </span>
        </div>

        <button type="button" class="ht-setting" (click)="logout()">
          <app-icon name="chevronLeft" />
          <span><strong>Log out / switch account</strong><small class="ht-muted">Your habits stay saved on this device.</small></span>
        </button>
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
        Everything is saved on this device: in the <code>data</code> folder on the computer, and inside the app on your phone.
        Each account has its own file.
      </p>

      <p class="ht-kicker">DANGER ZONE</p>
      <div class="ht-settings">
        <div class="ht-setting">
          <app-icon name="trash" />
          <span>
            <strong>Delete account</strong>
            <small class="ht-muted">Removes this account and all its habits from this device. This cannot be undone.</small>
            <input class="ht-field" type="password" autocomplete="current-password" placeholder="Enter your password to confirm"
                   [value]="deletePassword()" (input)="deletePassword.set(text($event))" />
            <div style="margin-top: 8px">
              <button type="button" class="btn btn--danger btn--sm" [disabled]="busy() || !deletePassword()" (click)="confirmDelete.set(true)">Delete my account</button>
            </div>
            @if (deleteError()) { <small class="ht-error">{{ deleteError() }}</small> }
          </span>
        </div>
      </div>
    </section>

    <app-confirmation-dialog
      [open]="confirmDelete()"
      title="Delete account"
      [message]="'Delete @' + (account()?.username || '') + ' and all its habits? This cannot be undone.'"
      confirmLabel="Delete"
      (cancelled)="confirmDelete.set(false)"
      (confirmed)="deleteAccount()" />
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

  private readonly auth = inject(AuthService);
  readonly account = this.auth.current;
  readonly fingerprintSupported = signal(false);
  readonly busy = signal(false);
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly recoveryCode = signal('');
  readonly accountMessage = signal('');
  readonly accountError = signal(false);
  readonly deletePassword = signal('');
  readonly deleteError = signal('');
  readonly confirmDelete = signal(false);

  constructor() {
    void this.reminders.permission().then((value) => this.permission.set(value));
    void this.auth.biometricAvailable().then((value) => this.fingerprintSupported.set(value));
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async saveName(event: Event): Promise<void> {
    const name = (event.target as HTMLInputElement).value;
    await this.runAccount(async () => {
      await this.auth.rename(name);
      this.storage.saveSettings({ displayName: name });
      return 'Name saved.';
    });
  }

  async toggleFingerprint(): Promise<void> {
    const on = !this.account()?.biometric;
    await this.runAccount(async () => {
      await this.auth.setBiometric(on);
      return on ? 'Fingerprint unlock is on.' : 'Fingerprint unlock is off.';
    });
  }

  async changePassword(): Promise<void> {
    await this.runAccount(async () => {
      if (this.newPassword() !== this.confirmPassword()) {
        throw new Error('The new passwords do not match.');
      }
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      return 'Password changed.';
    });
  }

  async newRecoveryCode(): Promise<void> {
    await this.runAccount(async () => {
      if (!this.currentPassword()) {
        throw new Error('Enter your current password first.');
      }
      this.recoveryCode.set(await this.auth.newRecoveryCode(this.currentPassword()));
      this.currentPassword.set('');
      return '';
    });
  }

  logout(): void {
    void this.auth.logout();
  }

  async deleteAccount(): Promise<void> {
    this.confirmDelete.set(false);
    this.busy.set(true);
    try {
      await this.auth.deleteAccount(this.deletePassword());
    } catch (error) {
      this.deleteError.set(error instanceof Error ? error.message : 'The account could not be deleted.');
    } finally {
      this.busy.set(false);
    }
  }

  private async runAccount(action: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    this.accountMessage.set('');
    try {
      this.accountMessage.set(await action());
      this.accountError.set(false);
    } catch (error) {
      this.accountMessage.set(error instanceof Error ? error.message : 'Something went wrong.');
      this.accountError.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  setTheme(theme: ThemeMode): void {
    this.storage.saveSettings({ theme });
  }

  async allowReminders(): Promise<void> {
    await this.reminders.allow();
    this.permission.set(await this.reminders.permission());
  }
}
