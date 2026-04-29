import { useState } from 'react';
import type { WireRow } from './types.ts';

interface Props { rows: WireRow[] }

export function WireLog({ rows }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className={`ec-wire-section${open ? ' ec-open' : ''}`}>
      <button className="ec-wire-toggle" onClick={() => setOpen((o) => !o)} type="button">
        <span className="ec-wire-toggle-arrow">▸</span>
        <span>Wire traffic</span>
        <span className="ec-wire-count-badge">{rows.length}</span>
        <span className="ec-wire-hint">underlying CDP / V8 Inspector JSON-RPC</span>
      </button>
      {open ? (
        <div className="ec-wire">
          {rows.map((r) => {
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id} className={`ec-wr ec-wr-${r.direction} ec-wr-${r.protocol}${isOpen ? ' ec-open' : ''}`}>
                <div className="ec-wr-head" onClick={() => toggleRow(r.id)}>
                  <span className="ec-wr-arrow">{r.direction === 'out' ? '→' : '←'}</span>
                  <span className="ec-wr-proto">{r.protocol.toUpperCase()}</span>
                  <span className="ec-wr-label">{r.label}</span>
                </div>
                {isOpen ? (
                  <pre className="ec-wr-body">{JSON.stringify(r.payload, null, 2)}</pre>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
