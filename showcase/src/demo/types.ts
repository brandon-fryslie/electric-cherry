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
