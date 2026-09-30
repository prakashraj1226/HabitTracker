import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat',
  host: { class: 'stat card' },
  template: `
    <p class="stat__label">{{ label() }}</p>
    <p class="stat__value">{{ value() }}</p>
    @if (detail()) {
      <p class="stat__detail">{{ detail() }}</p>
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly detail = input('');
}
