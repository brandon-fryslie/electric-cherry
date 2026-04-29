/** Domain types for the debugging demo. */

export interface WireMessage {
  method: string;
  params: unknown;
}

export type AppEffect =
  | { kind: 'highlight-elements'; selector: string }
  | { kind: 'click'; selector: string; sideEffect?: 'console-error' }
  | { kind: 'pull-logs' }
  | { kind: 'debugger-enabled' }
  | { kind: 'breakpoint-set'; file: string; line: number }
  | { kind: 'click-then-pause'; selector: string; file: string; line: number }
  | { kind: 'evaluate-popup'; expression: string; value: unknown }
  | { kind: 'connect-both' }
  | { kind: 'main-log'; text: string }
  | { kind: 'screenshot-flash' }
  | { kind: 'composed-report' }
  | { kind: 'resume-then-pause-again'; file: string; line: number };

export interface Callout {
  target: string;
  text: string;
  side: 'left' | 'right';
}

export interface ScenarioStep {
  narration: string;
  reasoning?: string;
  tool: string;
  args: Record<string, unknown>;
  cdp: WireMessage[];
  v8: WireMessage[];
  appEffect?: AppEffect;
  callout?: Callout;
  conclusion?: string;
}

export interface Scenario {
  id: string;
  title: string;
  why: string;
  userPrompt: string;
  assistantOpening: string;
  steps: ScenarioStep[];
}

export type BubbleKind =
  | 'user'
  | 'assistant'
  | 'assistant-reasoning'
  | 'assistant-toolcall'
  | 'assistant-observation';

export interface Bubble {
  id: number;
  kind: BubbleKind;
  text: string;
  toolCall?: { tool: string; args: Record<string, unknown> };
  cursor?: boolean;
}

export interface WireRow {
  id: number;
  direction: 'out' | 'in';
  protocol: 'cdp' | 'v8';
  label: string;
  payload: unknown;
}

export interface CalloutInstance {
  id: number;
  target: string;
  text: string;
  side: 'left' | 'right';
}

// ToolDetails moved to ./data/tool-details.ts; it's derived from the
// canonical MCP tool catalog at src/tool-catalog.ts so the inspector and
// the live MCP server can never drift.
export type { ToolDetails } from './data/tool-details.ts';

/** Identifier for a connection in the system map (top-of-stage topology
 *  diagram). The map exposes the routing structure of electric-cherry —
 *  one MCP surface in, two protocol surfaces out — and each branch
 *  flashes independently when traffic crosses it. */
export type ConnectionId = 'agent-cherry' | 'cherry-cdp' | 'cherry-v8';

/** A single traffic flash on one of the topology connections. The
 *  permanent arrow stays grey; while a flash is alive, an overlay path
 *  pulses the protocol's color via a CSS keyframe, then auto-removes
 *  when the animation completes (~700ms). Multiple overlapping flashes
 *  on the same connection layer naturally — the arrow reads as
 *  "sustained traffic." */
export interface ConnectionFlash {
  id: number;
  connection: ConnectionId;
  /** Color the flash uses: 'mcp' for agent ↔ cherry MCP request/response,
   *  'cdp' for renderer-side protocol traffic, 'v8' for main-process
   *  protocol traffic. */
  protocol: 'mcp' | 'cdp' | 'v8';
}

export type ConsoleLineKind = 'log' | 'error' | 'meta' | 'eval';

export interface RendererConsoleLine {
  kind: ConsoleLineKind;
  text: string;
}

export interface MainConsoleLine {
  text: string;
}

export interface RendererState {
  cdpAttached: boolean;
  debuggerEnabled: boolean;
  paused: { file: string; line: number } | null;
  breakpoints: { file: string; line: number }[];
  cart: { items: { sku: string; qty: number }[]; total: number };
  consoleLines: RendererConsoleLine[];
  flashScreenshot: boolean;
  highlightedSelector: string | null;
  clickedSelector: string | null;
}

export interface MainState {
  v8Attached: boolean;
  process: {
    pid: number;
    cwd: string;
    versions: { electron: string; chrome: string; node: string; v8: string };
    memory: { heapUsed: number; rss: number };
    ipcChannels: number;
  };
  consoleLines: MainConsoleLine[];
}
