/**
 * Shared types for Electric Cherry MCP
 */

import type { Browser, Page, CDPSession } from 'puppeteer';

// Node 24 + @types/node provides native WebSocket — no declaration needed

/**
 * CDP Debugger.paused event parameters
 */
export interface DebuggerPausedEvent {
  callFrames: CallFrame[];
  reason: string;
  data?: unknown;
  hitBreakpoints?: string[];
  asyncStackTrace?: unknown;
}

/**
 * CDP call frame from Debugger.paused
 */
export interface CallFrame {
  callFrameId: string;
  functionName: string;
  location: {
    scriptId: string;
    lineNumber: number;
    columnNumber?: number;
  };
  url: string;
  scopeChain: Scope[];
  this: unknown;
}

/**
 * CDP scope from call frame
 */
export interface Scope {
  type: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module' | 'wasm-expression-stack';
  object: unknown;
  name?: string;
}

/**
 * Breakpoint information stored per connection
 */
export interface BreakpointInfo {
  url: string;
  lineNumber: number;
  columnNumber: number;
  condition?: string;
}

/**
 * A Chrome connection managed by BrowserManager
 */
export interface Connection {
  /** Puppeteer Browser instance */
  browser: Browser;
  /** Current active page */
  page: Page;
  /** CDP session for debugger commands */
  cdpSession: CDPSession | null;
  /** WebSocket URL for this connection */
  wsUrl: string;
  /** Debugger paused state (null if not paused) */
  pausedData: DebuggerPausedEvent | null;
  /** Tracked breakpoints */
  breakpoints: Map<string, BreakpointInfo>;
  /** Whether debugger is enabled */
  debuggerEnabled: boolean;
  /** Captured console messages */
  consoleLogs: ConsoleMessage[];
  /** Whether console capture is enabled */
  consoleEnabled: boolean;
  /** Captured network requests */
  networkRequests: NetworkRequest[];
  /** Whether network monitoring is enabled */
  networkEnabled: boolean;
}

/**
 * Connection status for listing
 */
export interface ConnectionStatus {
  url: string;
  active: boolean;
  paused: boolean;
  debuggerEnabled: boolean;
}

/**
 * Result of query_elements JavaScript execution
 */
export interface QueryElementsResult {
  found: number;
  foundAfterDepthFilter: number;
  filteredByDepth: number;
  maxDepth: number;
  elements: ElementInfo[];
}

/**
 * Element information returned by query_elements
 */
export interface ElementInfo {
  index: number;
  selector: string;
  tag: string;
  text: string;
  id: string | null;
  classes: string[];
  visible: boolean;
  depth: number;
  childInfo: ChildInfo | null;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: {
    type: string | null;
    name: string | null;
    placeholder: string | null;
    value: string | null;
  };
}

/**
 * Child element info for depth-limited elements
 */
export interface ChildInfo {
  directChildren: number;
  totalDescendants: number;
}

/**
 * Result of click/fill JavaScript execution
 */
export interface DomActionResult {
  success: boolean;
  error?: string;
  clicked?: string;
  filled?: string;
  text?: string;
  type?: string;
}

/**
 * Text content in a tool result
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content in a tool result
 */
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * Tool result content — text or image
 */
export type ToolContent = TextContent | ImageContent;

/**
 * Tool result — index signature required for MCP SDK compatibility
 */
export interface ToolResult {
  [key: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
}

/**
 * V8 Inspector connection state
 */
export interface V8Connection {
  ws: WebSocket;
  port: number;
  pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
  nextId: number;
}

/**
 * Network request captured via CDP Network domain
 */
export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  /** null until response received */
  status: number | null;
  mimeType: string | null;
  timestamp: number;
  resourceType: string;
  encodedDataLength: number | null;
}

/**
 * Console message captured from Runtime.consoleAPICalled
 */
export interface ConsoleMessage {
  /** Log level: log, info, warn, error, debug */
  level: string;
  /** Message text */
  text: string;
  /** Timestamp when captured */
  timestamp: number;
  /** Source URL if available */
  url?: string;
  /** Line number if available */
  lineNumber?: number;
}
