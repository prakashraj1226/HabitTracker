import { Component, input, output } from '@angular/core';
import { WEEKDAY_HEADERS } from '../../core/constants/habit.constants';
import { CalendarCell } from '../../core/models/progress.model';

@Component({
  selector: 'app-habit-calendar',
  template: `
    <div class="day-grid day-grid--labels">
      @for (label of labels; track label) {
        <span>{{ label }}</span>
      }
    </div>
    <div class="day-grid">
      @for (cell of cells(); track cell.key) {
        @if (cell.state === 'pad') {
          <span class="day day--pad"></span>
        } @else {
          <button
            type="button"
            class="day"
            [attr.data-state]="cell.state"
            [class.day--selected]="cell.date === selected()"
            [attr.aria-pressed]="cell.date === selected()"
            [attr.aria-label]="cell.title"
            [attr.title]="cell.title"
            (click)="pick.emit(cell.date!)">
            {{ cell.label }}
          </button>
        }
      }
    </div>
  `,
})
export class HabitCalendarComponent {
  readonly cells = input.required<CalendarCell[]>();
  readonly selected = input<string | null>(null);
  readonly pick = output<string>();
  readonly labels = WEEKDAY_HEADERS;
}
