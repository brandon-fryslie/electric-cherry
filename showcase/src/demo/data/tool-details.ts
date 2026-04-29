// [LAW:one-source-of-truth] All tool reference content (description,
// inputSchema) comes from the canonical catalog the MCP server registers,
// at ../../../../src/tool-catalog.ts. The showcase only adds two derived
// values: the protocol the tool routes to (inferred from name prefix) and
// the boolean of whether a property is required (read off inputSchema).
//
// If a tool referenced by the palette goes missing from the catalog, the
// inspector will return null and the click is a no-op — fail-loud rather
// than show stale data. Add new tools to tool-catalog.ts and they appear
// here automatically; rename a tool there and the palette's reference to
// the old name surfaces immediately.

import { TOOL_CATALOG, type ToolCatalogEntry } from '../../../../src/tool-catalog.ts';

export type Protocol = 'cdp' | 'v8' | 'either';

export interface ToolDetails extends ToolCatalogEntry {
  protocol: Protocol;
}

function protocolFor(name: string): Protocol {
  if (name.startsWith('v8_')) return 'v8';
  if (name.startsWith('electron_')) return 'either';
  return 'cdp';
}

const BY_NAME: Record<string, ToolDetails> = Object.fromEntries(
  TOOL_CATALOG.map((entry) => [
    entry.name,
    { ...entry, protocol: protocolFor(entry.name) },
  ]),
);

export function getToolDetails(name: string): ToolDetails | null {
  return BY_NAME[name] ?? null;
}
