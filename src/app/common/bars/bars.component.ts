import { Component, input } from '@angular/core';
import { Bar } from '../../core/utils/stats.util';

@Component({
  selector: 'app-bars',
  template: `
    <div class="ht-bars" role="list">
      @for (bar of bars(); track bar.label) {
        <div class="ht-bars__col" role="listitem" [class.is-current]="bar.current" [class.is-future]="bar.percent === null"
             [attr.aria-label]="bar.label + ': ' + (bar.percent === null ? 'no data' : bar.percent + '%')">
          <span class="ht-bars__value">{{ bar.percent === null ? '' : bar.percent + '%' }}</span>
          <span class="ht-bars__track" [style.height.px]="height()">
            <i [style.height.%]="bar.percent ?? 0" [style.background]="color() || null"></i>
          </span>
          <span class="ht-bars__label">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
})
export class BarsComponent {
  readonly bars = input.required<Bar[]>();
  readonly height = input(120);
  readonly color = input<string>('');
}
