import { Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  host: { class: 'empty' },
  template: `
    <app-icon [name]="icon()" />
    <p class="empty__title">{{ title() }}</p>
    <p class="hint">{{ message() }}</p>
    <ng-content />
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly icon = input('inbox');
}
