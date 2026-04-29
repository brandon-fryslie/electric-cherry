// [LAW:one-source-of-truth] All tool data derives from the canonical
// catalog the MCP server registers. The showcase only adds three pieces of
// presentation metadata: the human-readable label per category, the
// protocol that category routes to, and the display order. Adding a new
// tool to the catalog with an existing category makes it appear here
// automatically; adding a new category requires updating CATEGORY_LABEL
// and CATEGORY_ORDER below — TS will flag the missing key.

import { TOOL_CATALOG, type ToolCategory } from '../../../../src/tool-catalog.ts';

export type Protocol = 'cdp' | 'v8' | 'either';

export interface ToolEntry {
  name: string;
}

export interface ToolGroup {
  category: ToolCategory;
  label: string;
  protocol: Protocol;
  tools: ToolEntry[];
}

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  electron:   'Electron',
  connection: 'Connection',
  dom:        'DOM (CDP)',
  renderer:   'Renderer (CDP)',
  debugger:   'Debugger (CDP)',
  network:    'Network (CDP)',
  v8:         'Main / V8 Inspector',
  admin:      'Tool Management',
};

const CATEGORY_PROTOCOL: Record<ToolCategory, Protocol> = {
  electron:   'either',
  connection: 'cdp',
  dom:        'cdp',
  renderer:   'cdp',
  debugger:   'cdp',
  network:    'cdp',
  v8:         'v8',
  admin:      'cdp',
};

// Categories displayed in the palette — admin/management tools are hidden.
const CATEGORY_ORDER: readonly ToolCategory[] = [
  'electron',
  'connection',
  'dom',
  'renderer',
  'debugger',
  'network',
  'v8',
];

// [LAW:dataflow-not-control-flow] Group catalog entries by category in one
// pass; the palette renders whatever the catalog provides — no per-tool
// branching, no hardcoded list to maintain.
function buildGroups(): ToolGroup[] {
  const buckets = new Map<ToolCategory, ToolEntry[]>();
  for (const entry of TOOL_CATALOG) {
    if (!buckets.has(entry.category)) buckets.set(entry.category, []);
    buckets.get(entry.category)!.push({ name: entry.name });
  }
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABEL[category],
      protocol: CATEGORY_PROTOCOL[category],
      tools: buckets.get(category) ?? [],
    }))
    .filter((g) => g.tools.length > 0);
}

export const TOOL_GROUPS: readonly ToolGroup[] = buildGroups();

/** Total number of tools the MCP server registers — useful for the
 *  palette header so the count stays accurate as the catalog grows. */
export const TOTAL_TOOL_COUNT = TOOL_CATALOG.length;
