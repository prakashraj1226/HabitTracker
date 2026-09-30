import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-habit-progress',
  template: `
    <div class="meter-row">
      <div
        class="meter"
        role="meter"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="clamped()"
        [attr.aria-label]="label()">
        <span class="meter__fill" [style.width.%]="clamped()"></span>
      </div>
      <span>{{ clamped() }}%</span>
    </div>
  `,
})
export class HabitProgressComponent {
  readonly value = input(0);
  readonly label = input('Completion');
  readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));
}
