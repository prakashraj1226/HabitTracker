import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../common/icon/icon.component';
import { AuthService } from '../core/services/auth.service';

type Mode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth',
  imports: [RouterLink, IconComponent],
  template: `
    <main class="ht ht-auth">
      <section class="ht-auth__card">
        <div class="ht-brand" style="justify-content: center; padding-bottom: 8px"><span><app-icon name="check" /></span> Habit Tick</div>

        @if (recoveryCode(); as code) {
          <h1 class="ht-h1" style="text-align: center">Save your recovery code</h1>
          <p class="ht-muted" style="text-align: center">
            If you forget your password, this code is the only way to reset it. Write it down or take a screenshot. It is shown only once.
          </p>
          <div class="ht-code" aria-label="Recovery code">{{ code }}</div>
          <button type="button" class="btn btn--secondary" style="width: 100%" (click)="copy(code)">
            {{ copied() ? 'Copied' : 'Copy code' }}
          </button>
          <button type="button" class="ht-save" (click)="finish()">
            {{ mode() === 'register' ? 'I saved it — continue' : 'I saved it — go to login' }}
          </button>
        } @else {
          <h1 class="ht-h1" style="text-align: center">{{ title() }}</h1>
          @if (mode() === 'register' && firstAccount()) {
            <p class="ht-note">This is the first account on this device. Your existing habits will be moved into it.</p>
          }

          <form (submit)="submit($event)" novalidate>
            @if (mode() === 'register') {
              <label class="ht-label" for="name">Name</label>
              <input class="ht-field" id="name" name="name" autocomplete="name" maxlength="40" [value]="name()" (input)="name.set(text($event))" />
            }

            <label class="ht-label" for="username">Username</label>
            <input class="ht-field" id="username" name="username" autocomplete="username" autocapitalize="none" maxlength="20"
                   [value]="username()" (input)="username.set(text($event))" />

            @if (mode() === 'forgot') {
              <label class="ht-label" for="code">Recovery code</label>
              <input class="ht-field" id="code" name="code" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX"
                     [value]="code()" (input)="code.set(text($event))" />
            }

            <label class="ht-label" for="password">{{ mode() === 'forgot' ? 'New password' : 'Password' }}</label>
            <div class="ht-pass">
              <input class="ht-field" id="password" name="password" [type]="showPassword() ? 'text' : 'password'"
                     [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" maxlength="64"
                     [value]="password()" (input)="password.set(text($event))" />
              <button type="button" class="ht-icon-btn" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                      (click)="showPassword.set(!showPassword())"><app-icon name="eye" /></button>
            </div>

            @if (mode() !== 'login') {
              <label class="ht-label" for="confirm">Confirm password</label>
              <input class="ht-field" id="confirm" name="confirm" [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password"
                     maxlength="64" [value]="confirm()" (input)="confirm.set(text($event))" />
              <p class="ht-muted ht-small" style="margin-top: 6px">At least 6 characters.</p>
            }

            @if (error()) { <p class="ht-error" role="alert">{{ error() }}</p> }

            <button type="submit" class="ht-save" style="position: static" [disabled]="busy()">
              {{ busy() ? 'Please wait…' : submitLabel() }}
            </button>
          </form>

          @if (mode() === 'login' && canUseFingerprint()) {
            <button type="button" class="btn btn--secondary" style="width: 100%; margin-top: 12px" [disabled]="busy()" (click)="fingerprint()">
              <app-icon name="target" /> Unlock with fingerprint
            </button>
          }

          <nav class="ht-auth__links">
            @switch (mode()) {
              @case ('login') {
                <a routerLink="/forgot">Forgot password?</a>
                <a routerLink="/register">Create account</a>
              }
              @case ('register') {
                @if (!firstAccount()) { <a routerLink="/login">I already have an account</a> }
              }
              @case ('forgot') {
                <a routerLink="/login">Back to login</a>
              }
            }
          </nav>
        }
      </section>
    </main>
  `,
})
export class AuthComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>(inject(ActivatedRoute).snapshot.data['mode'] ?? 'login');
  readonly name = signal('');
  readonly username = signal(this.mode() === 'register' ? '' : this.auth.lastUsername());
  readonly password = signal('');
  readonly confirm = signal('');
  readonly code = signal('');
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly recoveryCode = signal('');
  readonly copied = signal(false);
  readonly biometricReady = signal(false);

  readonly firstAccount = computed(() => !this.auth.hasAccounts());
  readonly title = computed(() => ({ login: 'Welcome back', register: 'Create account', forgot: 'Reset password' })[this.mode()]);
  readonly submitLabel = computed(() => ({ login: 'Log in', register: 'Create account', forgot: 'Reset password' })[this.mode()]);
  readonly canUseFingerprint = computed(() => this.biometricReady() && !!this.auth.accountFor(this.username())?.biometric);

  async ngOnInit(): Promise<void> {
    if (this.mode() !== 'register' && this.firstAccount()) {
      void this.router.navigateByUrl('/register');
      return;
    }
    if (this.mode() === 'login' && (await this.auth.biometricAvailable())) {
      this.biometricReady.set(true);
      if (this.canUseFingerprint()) {
        void this.fingerprint();
      }
    }
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) {
      return;
    }
    this.error.set('');
    if (this.mode() !== 'login' && this.password() !== this.confirm()) {
      this.error.set('The two passwords do not match.');
      return;
    }
    if (!this.username().trim() || !this.password()) {
      this.error.set('Enter your username and password.');
      return;
    }
    await this.run(async () => {
      if (this.mode() === 'login') {
        await this.auth.login(this.username(), this.password());
        await this.router.navigateByUrl('/today');
      } else if (this.mode() === 'register') {
        this.recoveryCode.set(await this.auth.register(this.name(), this.username(), this.password()));
      } else {
        if (!this.code().trim()) {
          throw new Error('Enter the recovery code you saved when you signed up.');
        }
        this.recoveryCode.set(await this.auth.resetPassword(this.username(), this.code(), this.password()));
      }
    });
  }

  async fingerprint(): Promise<void> {
    await this.run(async () => {
      await this.auth.loginWithBiometric(this.username());
      await this.router.navigateByUrl('/today');
    });
  }

  async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  finish(): void {
    void this.router.navigateByUrl(this.mode() === 'register' ? '/today' : '/login');
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
