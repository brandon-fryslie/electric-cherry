import { useEffect, useState, type RefObject } from 'react';
import type { CalloutInstance } from './types.ts';

interface Props {
  callouts: CalloutInstance[];
  stageRef: RefObject<HTMLDivElement | null>;
}

interface Positioned {
  id: number;
  text: string;
  side: 'left' | 'right';
  top: number;
  left: number;
  fade: boolean;
}

export function Callouts({ callouts, stageRef }: Props) {
  const [positioned, setPositioned] = useState<Positioned[]>([]);

  // Position callouts relative to their target elements within the stage.
  // We do this in an effect so the DOM has rendered the targets we need to
  // measure (highlight classes etc. are applied in the same render cycle).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageBox = stage.getBoundingClientRect();
    const next: Positioned[] = [];
    for (const c of callouts) {
      const el = stage.querySelector(c.target);
      if (!el) continue;
      const targetBox = el.getBoundingClientRect();
      const top = targetBox.top - stageBox.top + targetBox.height / 2 - 14;
      const left =
        c.side === 'right'
          ? targetBox.right - stageBox.left + 14
          : targetBox.left - stageBox.left - 14;
      next.push({ id: c.id, text: c.text, side: c.side, top, left, fade: false });
    }
    setPositioned(next);
  }, [callouts, stageRef]);

  return (
    <div className="ec-callouts">
      {positioned.map((p) => (
        <div
          key={p.id}
          className={`ec-callout ec-callout-${p.side}${p.fade ? ' ec-fade' : ''}`}
          style={{
            top: `${p.top}px`,
            left: `${p.left}px`,
            transform: p.side === 'left' ? 'translateX(-100%)' : undefined,
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}
