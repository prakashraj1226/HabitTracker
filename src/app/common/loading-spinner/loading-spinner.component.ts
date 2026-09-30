import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  host: { class: 'loading', role: 'status' },
  template: `
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ label() }}</span>
  `,
})
export class LoadingSpinnerComponent {
  readonly label = input('Loading');
}
