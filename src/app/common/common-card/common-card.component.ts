import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  host: { class: 'card' },
  template: `
    @if (title()) {
      <header class="card__header">
        <div>
          <h2>{{ title() }}</h2>
          @if (hint()) {
            <p>{{ hint() }}</p>
          }
        </div>
        <ng-content select="[cardActions]" />
      </header>
    }
    <div class="card__body">
      <ng-content />
    </div>
  `,
})
export class CommonCardComponent {
  readonly title = input('');
  readonly hint = input('');
}
