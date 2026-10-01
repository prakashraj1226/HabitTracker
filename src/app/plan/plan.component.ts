import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../common/icon/icon.component';
import { EntryService } from '../core/services/entry.service';
import { toDateKey, weekDates } from '../core/utils/date.util';
import { formatClock, todayLabel } from '../core/utils/habit-view.util';
import { EntrySheetComponent } from './entry-sheet.component';

@Component({
  selector: 'app-plan',
  imports: [RouterLink, IconComponent, EntrySheetComponent],
  template: `
    <section class="ht-page">
      <header class="ht-top">
        <h1 class="ht-title">{{ heading }}</h1>
        <a class="ht-icon-btn ht-mobile-only" routerLink="/settings" aria-label="Settings"><app-icon name="gear" /></a>
      </header>
      <nav class="ht-seg" aria-label="Plan or tasks">
        <a routerLink="/plan" class="is-on" aria-current="page">Plan</a>
        <a routerLink="/tasks">Tasks</a>
      </nav>
      <div class="ht-weekstrip">
        @for (day of week; track day.getTime()) {
          <button type="button" [class.is-on]="selectedKey() === key(day)" (click)="selected.set(day)">
            <small>{{ day.toLocaleDateString('en-GB', { weekday: 'short' }) }}</small>
            <div>{{ day.getDate() }}</div>
          </button>
        }
      </div>
      <p class="ht-muted">{{ selected().toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) }}</p>

      @for (entry of dayEntries(); track entry.id; let index = $index) {
        <div class="ht-slot">
          <span class="ht-time">{{ formatClock(entry.time) }}</span>
          <span class="ht-line"></span>
          <button type="button" class="ht-panel" (click)="entries.toggle(entry.id)">
            <strong [style.text-decoration]="entry.done ? 'line-through' : 'none'">{{ entry.title }}</strong>
            <small class="ht-muted">{{ entry.type === 'note' ? 'Note' : 'Task' }}</small>
          </button>
          <button type="button" class="ht-check" [class.is-on]="entry.done" [attr.aria-pressed]="entry.done" (click)="entries.toggle(entry.id)">
            <app-icon name="check" />
          </button>
        </div>
        @if (gapAfter(index); as gap) {
          <p class="ht-muted" style="margin:0 0 8px 80px">{{ gap }}</p>
        }
      } @empty {
        <div class="ht-empty">Nothing planned for this day.</div>
      }
      <button type="button" class="ht-chip" (click)="open.set(true)">+ Plan this slot</button>
    </section>

    @if (open()) {
      <app-entry-sheet [date]="selected()" [time]="defaultTime()" (closed)="close()" (saved)="save($event)" />
    }
  `,
})
export class PlanComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly entries = inject(EntryService);
  private readonly list = toSignal(this.entries.entries$, { initialValue: this.entries.getAll() });

  readonly heading = todayLabel();
  readonly today = new Date();
  readonly week = weekDates(this.today);
  readonly selected = signal(this.today);
  readonly open = signal(this.route.snapshot.queryParamMap.get('compose') === '1');
  readonly formatClock = formatClock;

  readonly selectedKey = computed(() => toDateKey(this.selected()));
  readonly dayEntries = computed(() => (this.list() ?? [])
    .filter((entry) => entry.date === this.selectedKey())
    .sort((left, right) => left.time.localeCompare(right.time)));

  key(date: Date): string {
    return toDateKey(date);
  }

  defaultTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  gapAfter(index: number): string {
    const items = this.dayEntries();
    const next = items[index + 1];
    const current = items[index];
    if (!next || !current) {
      return '';
    }
    const [ch, cm] = current.time.split(':').map(Number);
    const [nh, nm] = next.time.split(':').map(Number);
    const minutes = (nh * 60 + nm) - (ch * 60 + cm);
    if (minutes < 60) {
      return '';
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h gap`;
  }

  close(): void {
    this.open.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  save(draft: { title: string; time: string; type: 'task' | 'note'; inList: boolean }): void {
    this.entries.create({ ...draft, date: this.selectedKey() });
    this.close();
  }
}
