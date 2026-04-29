import { TOOL_PALETTE, GROUP_LABEL, GROUP_ORDER, GROUP_PROTOCOL } from './data/tools.ts';

interface ToolsPaletteProps {
  highlighted: string | null;
}

export function ToolsPalette({ highlighted }: ToolsPaletteProps) {
  // Bucket tools by group, preserving palette order within each group.
  const grouped: Record<string, ReadonlyArray<{ name: string }>> = {};
  for (const t of TOOL_PALETTE) {
    (grouped[t.group] = grouped[t.group] ? [...grouped[t.group], t] : [t]) as never;
  }

  return (
    <section className="ec-actor ec-cherry">
      <header className="ec-actor-head">
        <span className="ec-avatar ec-cherry-avatar">🍒</span>
        <span className="ec-actor-title">
          <span className="ec-actor-name">electric-cherry</span>
          <span className="ec-actor-sub">MCP server · 30 tools</span>
        </span>
      </header>
      <div className="ec-tools">
        {GROUP_ORDER.map((g) => (
          <div className="ec-tool-group" key={g}>
            <div className="ec-tg-label">{GROUP_LABEL[g]}</div>
            <div className="ec-tg-tools">
              {(grouped[g] ?? []).map((t) => (
                <span
                  key={t.name}
                  className={[
                    'ec-tool',
                    highlighted === t.name ? 'ec-tool-active' : '',
                  ].filter(Boolean).join(' ')}
                  data-protocol={GROUP_PROTOCOL[g]}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
