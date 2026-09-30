import { Component, computed, input } from '@angular/core';
import { DayBar } from '../../core/models/progress.model';

interface ChartColumn {
  key: string;
  x: number;
  y: number;
  h: number;
  w: number;
  label: string;
  labelX: number;
  fill: string;
  tip: string;
  draw: boolean;
  muted: boolean;
}

@Component({
  selector: 'app-week-bars',
  template: `
    <figure class="chart">
      <svg viewBox="0 0 480 208" role="img" aria-label="Weekly completion chart">
        @for (tick of layout().ticks; track tick.value) {
          <line class="chart__grid" [attr.x1]="pad.l" [attr.x2]="width - pad.r" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="chart__tick" [attr.x]="pad.l - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="middle">{{ tick.value }}</text>
        }
        <line class="chart__axis" [attr.x1]="pad.l" [attr.x2]="width - pad.r" [attr.y1]="layout().baseline" [attr.y2]="layout().baseline" />
        @for (column of layout().columns; track column.key) {
          @if (column.draw) {
            <rect [attr.x]="column.x" [attr.y]="column.y" [attr.width]="column.w" [attr.height]="column.h" [attr.fill]="column.fill" rx="2">
              <title>{{ column.tip }}</title>
            </rect>
          }
          <text class="chart__label" [class.chart__label--muted]="column.muted" [attr.x]="column.labelX" [attr.y]="height - 8" text-anchor="middle">
            {{ column.label }}
          </text>
        }
      </svg>
    </figure>
  `,
})
export class WeekBarsComponent {
  readonly bars = input.required<DayBar[]>();
  readonly width = 480;
  readonly height = 208;
  readonly pad = { l: 36, r: 12, t: 22, b: 28 };

  readonly layout = computed(() => {
    const bars = this.bars();
    const count = Math.max(bars.length, 1);
    const plotWidth = this.width - this.pad.l - this.pad.r;
    const plotHeight = this.height - this.pad.t - this.pad.b;
    const slot = plotWidth / count;
    const barWidth = Math.min(26, slot * 0.5);
    const yOf = (value: number) => this.pad.t + plotHeight * (1 - value / 100);
    return {
      baseline: yOf(0),
      ticks: [0, 50, 100].map((value) => ({ value, y: yOf(value) })),
      columns: bars.map((bar, index): ChartColumn => {
        const hidden = bar.state === 'future' || bar.state === 'off';
        const value = hidden ? 0 : bar.state === 'miss' && bar.percentage === 0 ? 8 : bar.percentage;
        const y = yOf(value);
        return {
          key: bar.date,
          x: this.pad.l + slot * index + (slot - barWidth) / 2,
          y,
          h: Math.max(0, yOf(0) - y),
          w: barWidth,
          label: bar.label.slice(0, 3),
          labelX: this.pad.l + slot * index + slot / 2,
          fill: barFill(bar.state),
          tip: barTip(bar),
          draw: !hidden,
          muted: hidden,
        };
      }),
    };
  });
}

function barFill(state: DayBar['state']): string {
  if (state === 'complete') return '#1f5fbf';
  if (state === 'partial') return '#c48a12';
  if (state === 'miss') return '#c4524a';
  return '#1f5fbf';
}

function barTip(bar: DayBar): string {
  if (bar.state === 'future') return `${bar.label}: not yet`;
  if (bar.state === 'off' || bar.total === 0) return `${bar.label}: nothing scheduled`;
  return `${bar.label}: ${bar.percentage}% · ${bar.completed} of ${bar.total}`;
}
