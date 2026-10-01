import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

const svg = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS: Record<string, string> = {
  dashboard: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  habits: svg('<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  settings: svg('<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  eye: svg('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/>'),
  trash: svg('<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>'),
  check: svg('<path d="M5 12l5 5L20 7"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>'),
  chevronLeft: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevronRight: svg('<path d="M9 5l7 7-7 7"/>'),
  activity: svg('<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/>'),
  droplet: svg('<path d="M12 3s6 6.4 6 10.2a6 6 0 0 1-12 0C6 9.4 12 3 12 3z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/>'),
  heart: svg('<path d="M20.8 8.6a4.4 4.4 0 0 0-8.8 1 4.4 4.4 0 0 0-8.8-1c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z"/>'),
  coffee: svg('<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  gym: svg('<path d="M2 10.5v3M5 8v8M8 12h8M19 8v8M22 10.5v3"/>'),
  star: svg('<path d="M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5.1L12 15.2 7.5 17.4l.9-5.1L4.8 8.8l5-.7L12 3.5z"/>'),
  run: svg('<circle cx="15" cy="5" r="2"/><path d="M8 21l3-6 3 2 3-5M6 12l3 1 2-3 4 1"/>'),
  food: svg('<path d="M4 10h16M6 10c0 5 2 8 6 8s6-3 6-8M8 6c.5 1.5 1.2 2.2 2 2.2S11.5 7.5 12 6c.5 1.5 1.2 2.2 2 2.2S15.5 7.5 16 6"/>'),
  music: svg('<path d="M9 18a3 3 0 1 1-2-2.8V6l10-2v10"/><circle cx="17" cy="14" r="3"/>'),
  bell: svg('<path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  more: svg('<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'),
  flame: svg('<path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-2 1.5-3.5 2-5 1.2 1.5 2 2 3 2 0-2 0-4 0-5z"/>'),
  archive: svg('<path d="M3 6h18v3H3zM5 9v10h14V9"/><path d="M10 13h4"/>'),
  plan: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M4 9h16"/>'),
  tasks: svg('<path d="M9 7h10M9 12h10M9 17h10"/><path d="M4.5 7l1 1 2-2M4.5 12l1 1 2-2M4.5 17l1 1 2-2"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2-5.3"/><path d="M4 4v5h5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>'),
  alert: svg('<path d="M12 3l10 17H2L12 3z"/><path d="M12 9v5M12 17h.01"/>'),
  inbox: svg('<path d="M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/><path d="M3 13h5l2 3h4l2-3h5"/>'),
};

@Component({
  selector: 'app-icon',
  host: { class: 'icon', 'aria-hidden': 'true' },
  template: `<span class="icon__svg" [innerHTML]="markup()"></span>`,
})
export class IconComponent {
  readonly name = input.required<string>();
  private readonly sanitizer = inject(DomSanitizer);
  readonly markup = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ICONS['target']));
}
