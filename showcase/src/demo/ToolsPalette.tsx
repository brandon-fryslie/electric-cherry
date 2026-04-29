import { TOOL_GROUPS, TOTAL_TOOL_COUNT } from './data/tools.ts';

interface ToolsPaletteProps {
  highlighted: string | null;
  onToolClick: (toolName: string) => void;
}

export function ToolsPalette({ highlighted, onToolClick }: ToolsPaletteProps) {
  return (
    <section className="ec-actor ec-cherry">
      <header className="ec-actor-head">
        <span className="ec-avatar ec-cherry-avatar">🍒</span>
        <span className="ec-actor-title">
          <span className="ec-actor-name">electric-cherry</span>
          <span className="ec-actor-sub">
            MCP server · {TOTAL_TOOL_COUNT} tools
          </span>
        </span>
      </header>
      <div className="ec-tools">
        {TOOL_GROUPS.map((group) => (
          <div className="ec-tool-group" key={group.category}>
            <div className="ec-tg-label">{group.label}</div>
            <div className="ec-tg-tools">
              {group.tools.map((t) => (
                <button
                  type="button"
                  key={t.name}
                  className={[
                    'ec-tool',
                    highlighted === t.name ? 'ec-tool-active' : '',
                  ].filter(Boolean).join(' ')}
                  data-protocol={group.protocol}
                  data-tool={t.name}
                  onClick={() => onToolClick(t.name)}
                  title={`Open ${t.name} reference`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
