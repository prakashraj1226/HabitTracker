import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  host: { class: 'page-header' },
  template: `
    <div>
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p>{{ subtitle() }}</p>
      }
    </div>
    <div class="page-header__actions">
      <ng-content />
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
