import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface DateRangeValue {
  start: Date | null;
  end: Date | null;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  iso: string;
}

interface Preset {
  key: string;
  label: string;
  range: () => DateRangeValue;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function startOfWeek(d: Date): Date {
  // Semaine commençant le lundi
  const r = startOfDay(d);
  const dow = (r.getDay() + 6) % 7; // 0 = lundi
  return addDays(r, -dow);
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d: Date): Date { return endOfDay(new Date(d.getFullYear(), 11, 31)); }
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function pad(n: number): string { return n.toString().padStart(2, '0'); }

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="drf-wrap">
      <button type="button" class="drf-trigger" [class.has-value]="value.start || value.end" (click)="toggle($event)">
        <mat-icon class="drf-trigger-icon">date_range</mat-icon>
        <span class="drf-trigger-text">{{ triggerLabel() }}</span>
        @if (value.start || value.end) {
          <mat-icon class="drf-trigger-clear" (click)="clearAndClose($event)">close</mat-icon>
        }
      </button>

      @if (open()) {
        <div class="drf-panel" #panelRef (click)="$event.stopPropagation()"
             [style.top.px]="panelTop()"
             [style.left.px]="panelLeftPos()">

          <div class="drf-presets">
            @for (p of presets; track p.key) {
              <button type="button" class="drf-preset-btn" [class.active]="activePreset() === p.key" (click)="applyPreset(p)">
                {{ p.label }}
              </button>
            }
          </div>

          <div class="drf-body">
            <div class="drf-calendars">
              <div class="drf-month">
                <div class="drf-month-head">
                  <button type="button" class="drf-nav" (click)="shiftMonth(-1)"><mat-icon>chevron_left</mat-icon></button>
                  <span class="drf-month-label">{{ monthLabel(leftMonth()) }}</span>
                  <span class="drf-nav-spacer"></span>
                </div>
                <div class="drf-dow-row">
                  @for (d of dowLabels; track d) { <span>{{ d }}</span> }
                </div>
                <div class="drf-grid">
                  @for (cell of leftGrid(); track cell.iso) {
                    <button type="button" class="drf-day"
                      [class.out]="!cell.inMonth"
                      [class.today]="isToday(cell.date)"
                      [class.selected-start]="sameDay(cell.date, draftStart())"
                      [class.selected-end]="sameDay(cell.date, draftEnd())"
                      [class.in-range]="inRange(cell.date)"
                      (click)="pickDay(cell.date)">
                      {{ cell.date.getDate() }}
                    </button>
                  }
                </div>
                @if (showTime) {
                  <div class="drf-time-row">
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('start','h',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftStart()?.getHours() ?? 0) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('start','h',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                    <span class="drf-time-colon">:</span>
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('start','m',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftStart()?.getMinutes() ?? 0) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('start','m',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                    <span class="drf-time-colon">:</span>
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('start','s',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftStart()?.getSeconds() ?? 0) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('start','s',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                  </div>
                }
              </div>

              <div class="drf-month">
                <div class="drf-month-head">
                  <span class="drf-nav-spacer"></span>
                  <span class="drf-month-label">{{ monthLabel(rightMonth()) }}</span>
                  <button type="button" class="drf-nav" (click)="shiftMonth(1)"><mat-icon>chevron_right</mat-icon></button>
                </div>
                <div class="drf-dow-row">
                  @for (d of dowLabels; track d) { <span>{{ d }}</span> }
                </div>
                <div class="drf-grid">
                  @for (cell of rightGrid(); track cell.iso) {
                    <button type="button" class="drf-day"
                      [class.out]="!cell.inMonth"
                      [class.today]="isToday(cell.date)"
                      [class.selected-start]="sameDay(cell.date, draftStart())"
                      [class.selected-end]="sameDay(cell.date, draftEnd())"
                      [class.in-range]="inRange(cell.date)"
                      (click)="pickDay(cell.date)">
                      {{ cell.date.getDate() }}
                    </button>
                  }
                </div>
                @if (showTime) {
                  <div class="drf-time-row">
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('end','h',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftEnd()?.getHours() ?? 23) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('end','h',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                    <span class="drf-time-colon">:</span>
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('end','m',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftEnd()?.getMinutes() ?? 59) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('end','m',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                    <span class="drf-time-colon">:</span>
                    <div class="drf-time-seg">
                      <button type="button" class="drf-time-up" (click)="bumpTime('end','s',1)"><mat-icon>keyboard_arrow_up</mat-icon></button>
                      <span>{{ pad2(draftEnd()?.getSeconds() ?? 59) }}</span>
                      <button type="button" class="drf-time-down" (click)="bumpTime('end','s',-1)"><mat-icon>keyboard_arrow_down</mat-icon></button>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="drf-footer">
              <span class="drf-summary">{{ summaryLabel() }}</span>
              <div class="drf-footer-actions">
                <button type="button" class="drf-btn drf-btn-ghost" (click)="cancel()">Annuler</button>
                <button type="button" class="drf-btn drf-btn-primary" (click)="accept()">Appliquer</button>
              </div>
            </div>
          </div>

        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .drf-wrap { position: relative; display: block; width: 100%; }

    .drf-trigger {
      display: flex; align-items: center; gap: 8px;
      width: 100%; height: 44px; padding: 0 12px; min-width: 0;
      border: 1.5px solid #dde3ec; border-radius: 10px;
      background: #f8fafc; cursor: pointer; font-family: inherit;
      transition: border-color .2s, background .2s;
      &:hover { border-color: #b8c4d4; }
      &.has-value { border-color: #2a5fa0; background: white; }
    }
    .drf-trigger-icon { color: #78909c; font-size: 19px; width: 19px; height: 19px; flex-shrink: 0; }
    .drf-trigger-text { flex: 1; text-align: left; font-size: 13px; color: #1a2742; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .drf-trigger-clear { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; flex-shrink: 0; &:hover { color: #ef4444; } }

    .drf-panel {
      /* position:fixed (et non absolute) + coordonnées calculées en JS depuis
         la position réelle du déclencheur à l'écran : un panneau absolute
         reste dans la chaîne de blocs englobants de ses ancêtres, donc un
         ancêtre avec overflow (ex. une barre de filtres qui défile
         horizontalement) le rogne et le rend invisible au clic. En fixed, il
         échappe à ce rognage quel que soit le conteneur qui l'héberge. */
      position: fixed; z-index: 300;
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      box-shadow: 0 16px 48px rgba(16,35,64,0.18);
      display: flex; overflow: hidden;
      animation: drf-pop .15s ease both;
    }
    @keyframes drf-pop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

    .drf-presets {
      display: flex; flex-direction: column; gap: 2px;
      padding: 10px; border-right: 1px solid #eef1f6; min-width: 150px;
      background: #f8fafc;
    }
    .drf-preset-btn {
      text-align: left; border: none; background: transparent; cursor: pointer;
      padding: 9px 12px; border-radius: 8px; font-size: 12.5px; color: #37474f; font-family: inherit;
      &:hover { background: #eef2f7; }
      &.active { background: #1a3a5c; color: white; font-weight: 600; }
    }

    .drf-body { display: flex; flex-direction: column; min-width: 540px; }
    .drf-calendars { display: flex; }
    .drf-month { flex: 1; padding: 14px 16px 10px; }
    .drf-month + .drf-month { border-left: 1px solid #eef1f6; }

    .drf-month-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .drf-month-label { font-size: 13.5px; font-weight: 700; color: #1a2742; }
    .drf-nav { width: 26px; height: 26px; border: none; background: transparent; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; color: #78909c;
      &:hover { background: #eef2f7; color: #1a3a5c; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .drf-nav-spacer { width: 26px; height: 26px; }

    .drf-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px;
      span { text-align: center; font-size: 10.5px; font-weight: 700; color: #90a4ae; text-transform: uppercase; }
    }
    .drf-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 2px; }
    .drf-day {
      aspect-ratio: 1; border: none; background: transparent; cursor: pointer; font-family: inherit;
      font-size: 12.5px; color: #1a2742; border-radius: 8px; position: relative;
      &:hover { background: #eef2f7; }
      &.out { color: #c6cfd9; }
      &.today { font-weight: 800; color: #2a5fa0; }
      &.in-range { background: #e3ecf7; border-radius: 0; }
      &.selected-start, &.selected-end { background: #1a3a5c; color: white !important; font-weight: 700; border-radius: 8px; }
    }

    .drf-time-row { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; }
    .drf-time-seg {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      span { font-size: 15px; font-weight: 700; color: #1a2742; width: 26px; text-align: center; }
    }
    .drf-time-up, .drf-time-down {
      width: 22px; height: 16px; border: none; background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center; color: #90a4ae; padding: 0;
      &:hover { color: #1a3a5c; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .drf-time-colon { font-size: 14px; font-weight: 700; color: #90a4ae; align-self: center; margin-top: 2px; }

    .drf-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 16px; border-top: 1px solid #eef1f6;
    }
    .drf-summary { font-size: 11.5px; color: #78909c; }
    .drf-footer-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .drf-btn { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; }
    .drf-btn-ghost { background: #eef2f7; color: #37474f; &:hover { background: #e2e8f0; } }
    .drf-btn-primary { background: #1a3a5c; color: white; &:hover { background: #142e49; } }

    @media (max-width: 640px) {
      /* "top: auto" seul (sans "bottom") force un repositionnement fixed via
         l'algorithme de position statique, qui se base sur la position du
         panneau dans le flux du document — donc sur le scroll de la page au
         moment de l'ouverture — plutôt que sur le viewport. Résultat : le
         panneau pouvait apparaître flottant n'importe où sur un long listing
         scrollé, au lieu d'être ancré en bas d'écran. "bottom" fixe ancre le
         panneau au viewport, indépendamment du scroll. */
      .drf-panel { position: fixed; left: 8px; right: 8px; top: auto; bottom: 12px; flex-direction: column; max-height: 85vh; overflow-y: auto; }
      .drf-presets { flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid #eef1f6; }
      .drf-body { min-width: 0; }
      .drf-calendars { flex-direction: column; }
      .drf-month + .drf-month { border-left: none; border-top: 1px solid #eef1f6; }
    }
  `]
})
export class DateRangeFilterComponent implements OnChanges {
  @Input() value: DateRangeValue = { start: null, end: null };
  @Input() placeholder = 'Toutes les dates';
  @Input() showTime = true;
  @Output() valueChange = new EventEmitter<DateRangeValue>();

  private el = inject(ElementRef);
  @ViewChild('panelRef') panelRef?: ElementRef<HTMLElement>;

  open = signal(false);
  panelTop = signal<number | null>(null);
  panelLeftPos = signal<number | null>(null);
  draftStart = signal<Date | null>(null);
  draftEnd   = signal<Date | null>(null);
  activePreset = signal<string | null>(null);
  leftMonth  = signal<Date>(startOfMonth(new Date()));

  dowLabels = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

  presets: Preset[] = [
    { key: 'clear',      label: 'Toutes les dates',   range: () => ({ start: null, end: null }) },
    { key: 'today',      label: "Aujourd'hui",        range: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
    { key: 'yesterday',  label: 'Hier',                range: () => { const y = addDays(new Date(), -1); return { start: startOfDay(y), end: endOfDay(y) }; } },
    { key: 'thisWeek',   label: 'Cette semaine',       range: () => { const s = startOfWeek(new Date()); return { start: s, end: endOfDay(addDays(s, 6)) }; } },
    { key: 'lastWeek',   label: 'Semaine dernière',    range: () => { const s = addDays(startOfWeek(new Date()), -7); return { start: s, end: endOfDay(addDays(s, 6)) }; } },
    { key: 'thisMonth',  label: 'Ce mois-ci',          range: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    { key: 'lastMonth',  label: 'Mois dernier',        range: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); return { start: s, end: endOfMonth(s) }; } },
    { key: 'thisYear',   label: 'Cette année',         range: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
    { key: 'lastYear',   label: 'Année dernière',      range: () => { const d = new Date(); const s = new Date(d.getFullYear() - 1, 0, 1); return { start: s, end: endOfYear(s) }; } },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !this.open()) {
      this.draftStart.set(this.value.start);
      this.draftEnd.set(this.value.end);
    }
  }

  @HostListener('document:click')
  onDocClick(): void { this.open.set(false); }

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.open()) { this.open.set(false); return; }
    this.draftStart.set(this.value.start);
    this.draftEnd.set(this.value.end);
    this.activePreset.set(null);
    this.leftMonth.set(startOfMonth(this.value.start ?? new Date()));
    this.panelTop.set(null);
    this.panelLeftPos.set(null);
    this.open.set(true);
    // Positionnement initial dès l'ouverture, depuis le déclencheur (toujours
    // mesurable) : évite un flash en haut à gauche de l'écran le temps que le
    // panneau lui-même existe dans le DOM pour être affiné ci-dessous.
    this.positionFromTrigger();
    // Le panneau n'existe pas encore dans le DOM tant que @if (open()) n'a pas
    // été rendu ; on attend le prochain tick pour pouvoir le mesurer et
    // corriger un éventuel débordement à droite.
    setTimeout(() => this.adjustPanelPosition());
  }

  private positionFromTrigger(): void {
    if (window.innerWidth <= 640) return;
    const trigger = (this.el.nativeElement as HTMLElement).querySelector('.drf-trigger');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    this.panelTop.set(r.bottom + 8);
    this.panelLeftPos.set(r.left);
  }

  private adjustPanelPosition(): void {
    // Sur mobile, le panneau passe en position fixed pleine largeur (voir le
    // @media 640px) : aucun recalage à faire dans ce cas.
    if (window.innerWidth <= 640) return;
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const margin = 12;
    const overflowRight = panelRect.right - window.innerWidth + margin;
    if (overflowRight > 0) {
      this.panelLeftPos.set(Math.max(margin, panelRect.left - overflowRight));
    }
    // En position fixed, le panneau ne suit plus le scroll de la page : si le
    // bas déborde du viewport (déclencheur proche du bas de l'écran), il faut
    // le remonter nous-mêmes, sinon le pied (bouton Appliquer) est
    // inatteignable — avant, en position absolute, scroller la page suffisait.
    const overflowBottom = panelRect.bottom - window.innerHeight + margin;
    if (overflowBottom > 0) {
      this.panelTop.set(Math.max(margin, panelRect.top - overflowBottom));
    }
  }

  clearAndClose(ev: Event): void {
    ev.stopPropagation();
    this.value = { start: null, end: null };
    this.valueChange.emit(this.value);
    this.open.set(false);
  }

  rightMonth = (): Date => {
    const m = this.leftMonth();
    return new Date(m.getFullYear(), m.getMonth() + 1, 1);
  };

  shiftMonth(delta: number): void {
    const m = this.leftMonth();
    this.leftMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  private buildGrid(monthAnchor: Date): DayCell[] {
    const first = startOfMonth(monthAnchor);
    const gridStart = startOfWeek(first);
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      cells.push({ date: d, inMonth: d.getMonth() === first.getMonth(), iso: d.toISOString().slice(0, 10) });
    }
    return cells;
  }

  leftGrid  = (): DayCell[] => this.buildGrid(this.leftMonth());
  rightGrid = (): DayCell[] => this.buildGrid(this.rightMonth());

  monthLabel(d: Date): string {
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
  }

  isToday(d: Date): boolean { return sameDay(d, new Date()); }
  sameDay = sameDay;

  inRange(d: Date): boolean {
    const s = this.draftStart(); const e = this.draftEnd();
    if (!s || !e) return false;
    const t = startOfDay(d).getTime();
    return t > startOfDay(s).getTime() && t < startOfDay(e).getTime();
  }

  pickDay(d: Date): void {
    this.activePreset.set(null);
    const s = this.draftStart(); const e = this.draftEnd();
    if (!s || (s && e)) {
      // Nouvelle sélection : on garde l'heure déjà réglée (par défaut 00:00:00 / 23:59:59)
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      this.draftStart.set(start);
      this.draftEnd.set(null);
      return;
    }
    // s défini, e pas encore
    const end = new Date(d); end.setHours(23, 59, 59, 0);
    if (d.getTime() < s.getTime()) {
      // L'utilisateur a cliqué avant le point de départ : on inverse
      const newStart = new Date(d); newStart.setHours(0, 0, 0, 0);
      const newEnd = new Date(s); newEnd.setHours(23, 59, 59, 0);
      this.draftStart.set(newStart);
      this.draftEnd.set(newEnd);
    } else {
      this.draftEnd.set(end);
    }
  }

  applyPreset(p: Preset): void {
    const r = p.range();
    this.draftStart.set(r.start);
    this.draftEnd.set(r.end);
    this.activePreset.set(p.key);
    this.leftMonth.set(startOfMonth(r.start ?? new Date()));
  }

  bumpTime(which: 'start' | 'end', unit: 'h' | 'm' | 's', delta: number): void {
    const sig = which === 'start' ? this.draftStart : this.draftEnd;
    const base = sig() ?? (which === 'start' ? startOfDay(new Date()) : endOfDay(new Date()));
    const d = new Date(base);
    if (unit === 'h') d.setHours((d.getHours() + delta + 24) % 24);
    if (unit === 'm') d.setMinutes((d.getMinutes() + delta + 60) % 60);
    if (unit === 's') d.setSeconds((d.getSeconds() + delta + 60) % 60);
    sig.set(d);
  }

  pad2 = pad;

  triggerLabel(): string {
    const s = this.value.start; const e = this.value.end;
    if (!s && !e) return this.placeholder;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    if (s && e) return `${fmt(s)} – ${fmt(e)}`;
    if (s) return `À partir du ${fmt(s)}`;
    return `Jusqu'au ${fmt(e!)}`;
  }

  summaryLabel(): string {
    const s = this.draftStart(); const e = this.draftEnd();
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      (this.showTime ? `, ${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}:${this.pad2(d.getSeconds())}` : '');
    if (!s && !e) return 'Aucune période sélectionnée';
    if (s && e) return `${fmt(s)}  →  ${fmt(e)}`;
    if (s) return `${fmt(s)}  →  …`;
    return `…  →  ${fmt(e!)}`;
  }

  accept(): void {
    this.value = { start: this.draftStart(), end: this.draftEnd() };
    this.valueChange.emit(this.value);
    this.open.set(false);
  }

  cancel(): void {
    this.open.set(false);
  }
}
