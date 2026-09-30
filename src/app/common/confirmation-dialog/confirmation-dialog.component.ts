import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { CommonButtonComponent } from '../common-button/common-button.component';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [CommonButtonComponent],
  template: `
    @if (open()) {
      <div class="modal" (click)="cancelled.emit()">
        <div
          class="modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          (click)="$event.stopPropagation()">
          <h2 id="confirm-title">{{ title() }}</h2>
          <p>{{ message() }}</p>
          <div class="modal__actions">
            <app-button variant="secondary" (pressed)="cancelled.emit()">{{ cancelLabel() }}</app-button>
            <app-button [variant]="confirmVariant()" (pressed)="confirmed.emit()">{{ confirmLabel() }}</app-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmationDialogComponent {
  readonly open = input(false);
  readonly title = input('Confirm');
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly confirmVariant = input<'primary' | 'danger'>('danger');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      document.body.style.overflow = this.open() ? 'hidden' : '';
    });
    destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.open()) {
        this.cancelled.emit();
      }
    };
    document.addEventListener('keydown', onKey);
    destroyRef.onDestroy(() => document.removeEventListener('keydown', onKey));
  }
}
