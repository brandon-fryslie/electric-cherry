import { useEffect } from 'react';
import type { ToolDetails } from './data/tool-details.ts';

interface Props {
  tool: ToolDetails | null;
  onClose: () => void;
}

const PROTOCOL_LABEL: Record<ToolDetails['protocol'], string> = {
  cdp: 'CDP',
  v8: 'V8 Inspector',
  either: 'CDP + V8',
};

export function ToolInspector({ tool, onClose }: Props) {
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, onClose]);

  if (!tool) return null;

  // [LAW:dataflow-not-control-flow] Render the live schema as a list of
  // parameter rows; rows include type, default, required flag, and the
  // `description` from the same MCP catalog entry the server registers.
  const properties = tool.inputSchema.properties ?? {};
  const required = new Set(tool.inputSchema.required ?? []);
  const propEntries = Object.entries(properties);

  // Construct an example call from the schema: required-only fields with
  // type-shaped placeholders. Pure derivation from the catalog data — no
  // hand-written examples to drift.
  const exampleCall = exampleArgsFromSchema(tool.name, properties, required);

  return (
    <div
      className="ec-inspector-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ec-inspector"
        role="dialog"
        aria-label={`${tool.name} reference`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ec-inspector-head">
          <code className="ec-inspector-name">{tool.name}</code>
          <span
            className={`ec-inspector-badge ec-inspector-badge-${tool.protocol}`}
          >
            {PROTOCOL_LABEL[tool.protocol]}
          </span>
          <button
            type="button"
            className="ec-inspector-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="ec-inspector-description">{tool.description}</p>

        {propEntries.length > 0 ? (
          <div className="ec-inspector-section">
            <div className="ec-inspector-label">Parameters</div>
            <ul className="ec-param-list">
              {propEntries.map(([name, prop]) => (
                <li key={name} className="ec-param">
                  <div className="ec-param-head">
                    <code className="ec-param-name">{name}</code>
                    <span className="ec-param-type">{formatType(prop)}</span>
                    {required.has(name) ? (
                      <span className="ec-param-required">required</span>
                    ) : prop.default !== undefined ? (
                      <span className="ec-param-default">
                        default <code>{JSON.stringify(prop.default)}</code>
                      </span>
                    ) : (
                      <span className="ec-param-optional">optional</span>
                    )}
                  </div>
                  {prop.description ? (
                    <div className="ec-param-desc">{prop.description}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ec-inspector-noparams">No parameters.</p>
        )}

        <div className="ec-inspector-section">
          <div className="ec-inspector-label">Example call</div>
          <pre className="ec-inspector-code">
            <code>{exampleCall}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

function formatType(prop: { type: string; enum?: readonly unknown[] }): string {
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum.map((v) => JSON.stringify(v)).join(' | ');
  }
  return prop.type;
}

function exampleArgsFromSchema(
  toolName: string,
  properties: Record<string, { type: string; default?: unknown; enum?: readonly unknown[] }>,
  required: Set<string>,
): string {
  const args: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(properties)) {
    if (!required.has(name)) continue;
    args[name] = exampleValue(prop);
  }
  if (Object.keys(args).length === 0) {
    return `${toolName}()`;
  }
  return `${toolName}(${JSON.stringify(args, null, 2)})`;
}

function exampleValue(prop: { type: string; enum?: readonly unknown[] }): unknown {
  if (prop.enum && prop.enum.length > 0) return prop.enum[0];
  switch (prop.type) {
    case 'string':  return '<string>';
    case 'number':  return 0;
    case 'boolean': return false;
    case 'array':   return [];
    case 'object':  return {};
    default:        return null;
  }
}
