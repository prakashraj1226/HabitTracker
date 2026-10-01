import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Habit } from '../../core/models/habit.model';
import { HabitCompletionService } from '../../core/services/habit-completion.service';
import { habitColor } from '../../core/utils/habit-view.util';
import { dailyTarget } from '../../core/utils/stats.util';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-habit-row',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="ht-item" [class.is-done]="done()">
      <span class="ht-badge ht-badge--sm" [style.background]="color()"><app-icon [name]="habit().icon || 'star'" /></span>
      <a class="ht-item__text" [routerLink]="['/habits', habit().id]">
        <strong>{{ habit().name }}</strong>
        <small>{{ meta() }}</small>
      </a>
      @if (readonly()) {
        <span class="ht-check" [class.is-on]="done()" aria-hidden="true">
          @if (done()) { <app-icon name="check" /> } @else { <app-icon name="close" /> }
        </span>
      } @else if (habit().kind === 'measurable' || target() > 1) {
        <div class="ht-stepper" [class.is-on]="done()">
          <button type="button" (click)="step(-1)" [disabled]="amount() === 0" [attr.aria-label]="'Less ' + habit().name">
            <app-icon name="minus" />
          </button>
          <output>{{ amount() }}/{{ target() }}</output>
          <button type="button" (click)="step(1)" [attr.aria-label]="'More ' + habit().name"><app-icon name="plus" /></button>
        </div>
      } @else {
        <button type="button" class="ht-check" [class.is-on]="done()" (click)="toggle()"
                [attr.aria-pressed]="done()" [attr.aria-label]="(done() ? 'Undo ' : 'Complete ') + habit().name">
          <app-icon name="check" />
        </button>
      }
    </div>
  `,
})
export class HabitRowComponent {
  private readonly completions = inject(HabitCompletionService);

  readonly habit = input.required<Habit>();
  readonly date = input.required<string>();
  readonly amount = input(0);
  readonly meta = input('');
  readonly readonly = input(false);

  readonly target = computed(() => dailyTarget(this.habit()));
  readonly done = computed(() => this.amount() >= this.target());
  readonly color = computed(() => habitColor(this.habit()));

  toggle(): void {
    this.completions.toggleDone(this.habit(), this.date());
  }

  step(delta: number): void {
    this.completions.step(this.habit(), this.date(), delta);
  }
}
