import { Component, input, output, signal } from '@angular/core';
import { EntryType } from '../core/models/entry.model';
import { formatMediumDate } from '../core/utils/date.util';
import { formatClock } from '../core/utils/habit-view.util';

@Component({
  selector: 'app-entry-sheet',
  template: `
    <div class="ht-sheet" (click)="closed.emit()">
      <form (click)="$event.stopPropagation()" (submit)="submit($event)">
        <div class="ht-row">
          <h2 class="ht-h1" style="font-size:22px">Plan this slot</h2>
          <button class="ht-check is-on" type="submit" aria-label="Save" [disabled]="title().trim().length < 2">
            ✓
          </button>
        </div>
        <input class="ht-input" style="text-align:left" [value]="title()" placeholder="What are you working on?" (input)="onTitle($event)" />
        <div class="ht-split">
          <p class="ht-panel"><strong>{{ formatMediumDate(date()) }}</strong></p>
          <p class="ht-panel"><strong>{{ formatClock(time()) }}</strong></p>
        </div>
        <label class="ht-label">Time
          <input class="ht-field" type="time" [value]="time()" (input)="onTime($event)" />
        </label>
        <p class="ht-label">What is this?</p>
        @for (item of types; track item.id) {
          <button type="button" class="ht-choice" [class.is-on]="type() === item.id" (click)="type.set(item.id)">
            <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
          </button>
        }
      </form>
    </div>
  `,
})
export class EntrySheetComponent {
  readonly date = input.required<Date>();
  readonly time = input('09:00');
  readonly closed = output<void>();
  readonly saved = output<{ title: string; time: string; type: EntryType; inList: boolean }>();

  readonly types: { id: EntryType | 'list'; label: string; hint: string }[] = [
    { id: 'task', label: 'Task', hint: 'Track it and tick it off here' },
    { id: 'note', label: 'Note', hint: 'Just logging a moment from the day' },
    { id: 'list', label: 'Task in my list', hint: 'Also add it to your task list' },
  ];
  readonly title = signal('');
  readonly type = signal<EntryType | 'list'>('task');
  readonly chosenTime = signal('');

  formatMediumDate = formatMediumDate;
  formatClock = formatClock;

  onTitle(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onTime(event: Event): void {
    this.chosenTime.set((event.target as HTMLInputElement).value);
  }

  submit(event: Event): void {
    event.preventDefault();
    const title = this.title().trim();
    if (title.length < 2) {
      return;
    }
    const selected = this.type();
    this.saved.emit({
      title,
      time: this.chosenTime() || this.time(),
      type: selected === 'note' ? 'note' : 'task',
      inList: selected !== 'note',
    });
  }
}
