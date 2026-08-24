import React, { useCallback, useEffect, useRef, useState } from 'react';
import PadIcon from './PadIcon';

export interface Segment {
  id: string;
  label: string;
  /** Key into PadIcon's registry. */
  icon: string;
  disabled?: boolean;
  /** Overrides the id-derived accent. */
  accent?: Accent;
}

type Accent = 'create' | 'publish' | 'destroy' | 'neutral';

interface Props {
  segments: Segment[];
  /** What the pad is acting on — shown in the centre until a cell is focused. */
  title: string;
  subtitle?: string;
  onSelect: (id: string) => void;
  onEscape: () => void;
}

const TILE = 76;
const GAP = 6;
export const PAD_SIZE = TILE * 3 + GAP * 2; // 240

// Grid slots, reading order. 4 is the centre and never holds an action.
//   0 1 2      NW N NE
//   3 4 5   →  W  ·  E
//   6 7 8      SW S SE
const RING_SLOTS = [0, 1, 2, 3, 5, 6, 7, 8];
const SIX_SLOTS = [0, 1, 2, 6, 7, 8];  // full top and bottom rows — six in the
                                       // ring order would strand a corner blank
const CARDINAL_SLOTS = [1, 3, 5, 7];   // N W E S
const PAIR_SLOTS = [3, 5];             // W E

// Numpad maps 1:1 onto the eight cells. This is the thing a circle can't do.
const NUMPAD_TO_SLOT: Record<string, number> = {
  '7': 0, '8': 1, '9': 2,
  '4': 3, '6': 5,
  '1': 6, '2': 7, '3': 8,
};
const SLOT_TO_KEY: Record<number, string> = {
  0: '7', 1: '8', 2: '9',
  3: '4', 5: '6',
  6: '1', 7: '2', 8: '3',
};

function accentOf(seg: Segment): Accent {
  if (seg.accent) return seg.accent;
  if (seg.id === 'delete' || seg.id === 'confirm') return 'destroy';
  if (seg.id === 'publish') return 'publish';
  if (seg.id === 'branch' || seg.id === 'new-spec' || seg.id === 'new-prep' || seg.id === 'add-ing') return 'create';
  return 'neutral';
}

/** Which grid slots this many actions occupy, so small sets stay balanced. */
function slotsFor(count: number): number[] {
  if (count <= 2) return PAIR_SLOTS;
  if (count <= 4) return CARDINAL_SLOTS;
  if (count <= 6) return SIX_SLOTS;
  return RING_SLOTS;
}

export default function CommandPad({ segments, title, subtitle, onSelect, onEscape }: Props) {
  const [focused, setFocused] = useState<number | null>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(Date.now());
  // True once a pointer is seen held down — lets a press-drag-release gesture
  // commit, without a plain right-click's own mouseup firing an action.
  const dragArmed = useRef(false);

  // slot index -> segment
  const bySlot = new Map<number, Segment>();
  const slots = slotsFor(segments.length);
  segments.forEach((seg, i) => {
    if (slots[i] !== undefined) bySlot.set(slots[i], seg);
  });

  const commit = useCallback((seg: Segment | undefined) => {
    if (!seg || seg.disabled) return;
    onSelect(seg.id);
  }, [onSelect]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }

      const numpadSlot = NUMPAD_TO_SLOT[e.key];
      if (numpadSlot !== undefined && bySlot.has(numpadSlot)) {
        e.preventDefault();
        commit(bySlot.get(numpadSlot));
        return;
      }

      const filled = slots.filter(s => bySlot.has(s));
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        setFocused(cur => {
          const i = cur === null ? -1 : filled.indexOf(cur);
          return filled[(i + 1) % filled.length];
        });
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused(cur => {
          const i = cur === null ? 0 : filled.indexOf(cur);
          return filled[(i - 1 + filled.length) % filled.length];
        });
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && focused !== null) {
        e.preventDefault();
        commit(bySlot.get(focused));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Press-drag-release ──────────────────────────────────────────────────────
  // Long-press on touch (and right-mouse-hold on macOS) leaves the pointer down
  // when the pad opens, so flicking toward a tile and releasing should commit.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.buttons > 0) dragArmed.current = true;
    };
    const onUp = () => {
      // The click that opened the pad must not immediately fire an action.
      if (!dragArmed.current || Date.now() - openedAt.current < 180) {
        dragArmed.current = false;
        return;
      }
      dragArmed.current = false;
      if (focused !== null) commit(bySlot.get(focused));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const focusedSeg = focused !== null ? bySlot.get(focused) : undefined;

  // With six actions the cells either side of the centre are empty, so the
  // centre takes the whole row instead of leaving two dead squares. Eight
  // actions fill those slots and the centre stays a single cell.
  const wideCentre = !bySlot.has(3) && !bySlot.has(5);

  return (
    <div
      ref={padRef}
      className="cmd-pad"
      role="menu"
      aria-label={title}
      style={{ width: PAD_SIZE, height: PAD_SIZE, gap: GAP }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); onEscape(); }}
    >
      {Array.from({ length: 9 }, (_, slot) => {
        // Swallowed by the spanning centre.
        if (wideCentre && (slot === 3 || slot === 5)) return null;

        if (slot === 4) {
          return (
            <div
              key="centre"
              className={`cmd-pad__centre${wideCentre ? ' cmd-pad__centre--wide' : ''}`}
            >
              {/* Always the target, never the action. The tile you're pointing
                  at already says what it does — repeating it here just made the
                  centre flicker. What it can't say is *what you're acting on*. */}
              <span className="cmd-pad__centre-label">{title}</span>
              {(subtitle || focusedSeg?.disabled) && (
                <span className="cmd-pad__centre-sub">
                  {focusedSeg?.disabled ? 'unavailable' : subtitle}
                </span>
              )}
            </div>
          );
        }

        const seg = bySlot.get(slot);
        if (!seg) return <div key={slot} className="cmd-pad__blank" aria-hidden="true" />;

        return (
          <button
            key={seg.id}
            type="button"
            role="menuitem"
            className="cmd-pad__tile"
            data-accent={accentOf(seg)}
            data-focused={focused === slot || undefined}
            disabled={seg.disabled}
            title={seg.label}
            onPointerEnter={() => setFocused(slot)}
            onPointerLeave={() => setFocused(cur => (cur === slot ? null : cur))}
            onFocus={() => setFocused(slot)}
            onClick={e => { e.stopPropagation(); commit(seg); }}
          >
            <span className="cmd-pad__tile-key" aria-hidden="true">{SLOT_TO_KEY[slot]}</span>
            <span className="cmd-pad__tile-icon"><PadIcon name={seg.icon} /></span>
            <span className="cmd-pad__tile-label">{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
