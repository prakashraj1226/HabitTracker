import { Component, computed, input } from '@angular/core';
import { DayBar } from '../../core/models/progress.model';

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  labelX: number;
  showLabel: boolean;
  tip: string;
  draw: boolean;
}

@Component({
  selector: 'app-line-chart',
  template: `
    <figure class="chart">
      <svg viewBox="0 0 480 208" role="img" aria-label="Monthly completion chart">
        @for (tick of layout().ticks; track tick.value) {
          <line class="chart__grid" [attr.x1]="pad.l" [attr.x2]="width - pad.r" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="chart__tick" [attr.x]="pad.l - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="middle">{{ tick.value }}</text>
        }
        <line class="chart__axis" [attr.x1]="pad.l" [attr.x2]="width - pad.r" [attr.y1]="layout().baseline" [attr.y2]="layout().baseline" />
        @for (segment of layout().segments; track $index) {
          <polyline class="chart__line" [attr.points]="segment" />
        }
        @for (point of layout().points; track point.tip) {
          @if (point.draw) {
            <circle class="chart__dot" [attr.cx]="point.x" [attr.cy]="point.y" r="3">
              <title>{{ point.tip }}</title>
            </circle>
          }
          @if (point.showLabel) {
            <text class="chart__label" [attr.x]="point.labelX" [attr.y]="height - 8" text-anchor="middle">{{ point.label }}</text>
          }
        }
      </svg>
    </figure>
  `,
})
export class LineChartComponent {
  readonly points = input.required<DayBar[]>();
  readonly width = 480;
  readonly height = 208;
  readonly pad = { l: 36, r: 12, t: 22, b: 28 };

  readonly layout = computed(() => {
    const points = this.points();
    const count = Math.max(points.length, 1);
    const plotWidth = this.width - this.pad.l - this.pad.r;
    const plotHeight = this.height - this.pad.t - this.pad.b;
    const slot = plotWidth / count;
    const yOf = (value: number) => this.pad.t + plotHeight * (1 - value / 100);
    const placed = points.map((point, index): ChartPoint => {
      const hidden = point.state === 'future' || point.state === 'off';
      const day = Number(point.date.slice(-2));
      const x = this.pad.l + slot * index + slot / 2;
      return {
        x,
        y: yOf(hidden ? 0 : point.percentage),
        label: String(day),
        labelX: x,
        showLabel: day === 1 || day % 5 === 0,
        tip: pointTip(point, day),
        draw: !hidden,
      };
    });
    const segments: string[] = [];
    let current: string[] = [];
    placed.forEach((point) => {
      if (!point.draw) {
        if (current.length > 1) segments.push(current.join(' '));
        current = [];
        return;
      }
      current.push(`${point.x},${point.y}`);
    });
    if (current.length > 1) segments.push(current.join(' '));
    return {
      baseline: yOf(0),
      ticks: [0, 50, 100].map((value) => ({ value, y: yOf(value) })),
      points: placed,
      segments,
    };
  });
}

function pointTip(point: DayBar, day: number): string {
  if (point.state === 'future') return `${day}: not yet`;
  if (point.state === 'off' || point.total === 0) return `${day}: nothing scheduled`;
  return `${day}: ${point.percentage}% · ${point.completed} of ${point.total}`;
}
