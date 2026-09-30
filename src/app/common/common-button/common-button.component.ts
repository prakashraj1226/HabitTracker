import { Component, input, output } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type ButtonSize = 'md' | 'sm';

@Component({
  selector: 'app-button',
  template: `
    <button
      [type]="type()"
      class="btn"
      [class.btn--primary]="variant() === 'primary'"
      [class.btn--secondary]="variant() === 'secondary'"
      [class.btn--ghost]="variant() === 'ghost'"
      [class.btn--danger]="variant() === 'danger'"
      [class.btn--danger-ghost]="variant() === 'danger-ghost'"
      [class.btn--sm]="size() === 'sm'"
      [disabled]="disabled()"
      [attr.title]="title() || null"
      (click)="pressed.emit($event)">
      <ng-content />
    </button>
  `,
})
export class CommonButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly title = input('');
  readonly pressed = output<Event>();
}
