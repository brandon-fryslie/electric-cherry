/**
 * Tool catalog — the canonical list of MCP tools electric-cherry exposes.
 *
 * This is the single source of truth: the MCP server registers these for
 * ListTools, and the showcase site at showcase/ imports the same array to
 * render its tool inspector and palette. Edit a tool here and both
 * surfaces update.
 *
 * Types are locally defined so this module has zero runtime dependencies —
 * it can be imported from a browser bundle as easily as from the Node MCP
 * server. The shape is structurally compatible with `Tool` from
 * `@modelcontextprotocol/sdk/types.js`; the `category` field is extra and
 * the SDK ignores it.
 */

export interface ToolProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: readonly unknown[];
  items?: { type: string };
}

export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, ToolProperty>;
  required?: readonly string[];
}

/** Coarse category for grouping in UIs (showcase palette, future help
 *  output). 'admin' tools are management surfaces typically hidden from
 *  product demos. */
export type ToolCategory =
  | 'electron'
  | 'connection'
  | 'dom'
  | 'renderer'
  | 'v8'
  | 'network'
  | 'debugger'
  | 'admin';

export interface ToolCatalogEntry {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  category: ToolCategory;
}

export const TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  // === Electron App Discovery ===
  {
    category: 'electron',
    name: 'electron_setup',
    description:
      'Find an Electron app in /Applications and generate a launch command with debugging flags. Returns the exact command to run.',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: {
          type: 'string',
          description: 'Name of the app (e.g., "Obsidian", "Visual Studio Code", "Slack")',
        },
        cdp_port: {
          type: 'number',
          description: 'CDP port for renderer debugging (default: 9222)',
        },
        v8_port: {
          type: 'number',
          description: 'V8 Inspector port for main process (default: 9229)',
        },
      },
      required: ['app_name'],
    },
  },
  {
    category: 'electron',
    name: 'electron_connect',
    description:
      'Connect to a running Electron app on both CDP (renderer) and V8 Inspector (main process) ports.',
    inputSchema: {
      type: 'object',
      properties: {
        cdp_port: {
          type: 'number',
          description: 'CDP port (from electron_setup output)',
        },
        v8_port: {
          type: 'number',
          description: 'V8 Inspector port (from electron_setup output)',
        },
        connection_id: {
          type: 'string',
          description: 'Connection ID (default: "electron")',
        },
      },
      required: ['cdp_port', 'v8_port'],
    },
  },

  // === Chrome Connection Management ===
  {
    category: 'connection',
    name: 'chrome',
    description:
      'Connect to existing Chrome/Electron or launch a new Chrome instance with remote debugging.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '"connect" to existing Chrome or "launch" new instance',
          enum: ['connect', 'launch'],
        },
        port: {
          type: 'number',
          description: 'Remote debugging port',
          default: 9222,
        },
        connection_id: {
          type: 'string',
          description: 'Unique identifier for this connection',
          default: 'default',
        },
        host: {
          type: 'string',
          description: 'Host (for connect only)',
          default: 'localhost',
        },
        headless: {
          type: 'boolean',
          description: 'Run in headless mode (for launch only)',
          default: false,
        },
        user_data_dir: {
          type: 'string',
          description: 'Custom user data directory (for launch only)',
        },
        extra_args: {
          type: 'string',
          description: 'Additional Chrome flags (for launch only)',
        },
      },
      required: ['action'],
    },
  },
  {
    category: 'connection',
    name: 'chrome_list_connections',
    description: 'List all active Chrome connections with their status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    category: 'connection',
    name: 'chrome_switch_connection',
    description: 'Switch the active Chrome connection.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'ID of the connection to make active',
        },
      },
      required: ['connection_id'],
    },
  },
  {
    category: 'connection',
    name: 'chrome_disconnect',
    description: 'Disconnect from a Chrome instance.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'ID of the connection to disconnect',
        },
      },
      required: ['connection_id'],
    },
  },
  {
    category: 'connection',
    name: 'target',
    description: 'List or switch browser targets (pages, workers).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '"list" to show all targets or "switch" to change target',
          enum: ['list', 'switch'],
        },
        index: { type: 'number', description: 'Target index (for switch)' },
        title: { type: 'string', description: 'Partial title match (for switch)' },
        url: { type: 'string', description: 'URL pattern with * wildcards (for switch)' },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['action'],
    },
  },

  // === DOM Tools ===
  {
    category: 'dom',
    name: 'query_elements',
    description:
      'Find elements by CSS selector with DOM depth filtering. Returns tag, text, id, classes, visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (e.g., ".class", "#id", "button")' },
        limit: { type: 'number', description: 'Max elements to return', default: 20 },
        max_depth: { type: 'number', description: 'Max DOM depth from body (default: 3, max: 10)', default: 3 },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['selector'],
    },
  },
  {
    category: 'dom',
    name: 'click_element',
    description: 'Click an element matching the CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' },
        index: { type: 'number', description: 'Which matching element to click (0 = first)', default: 0 },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['selector'],
    },
  },
  {
    category: 'dom',
    name: 'fill_element',
    description: 'Fill text into an input element matching the CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input element' },
        text: { type: 'string', description: 'Text to enter' },
        index: { type: 'number', description: 'Which matching element (0 = first)', default: 0 },
        submit: { type: 'boolean', description: 'Press Enter after filling', default: false },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    category: 'dom',
    name: 'navigate',
    description: 'Navigate to a URL and wait for page load.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['url'],
    },
  },
  {
    category: 'dom',
    name: 'get_console_logs',
    description: 'Get console log messages from the browser.',
    inputSchema: {
      type: 'object',
      properties: {
        filter_level: { type: 'string', description: 'Filter: "all", "error", "warning", "info", "debug", "log"', default: 'all' },
        limit: { type: 'number', description: 'Max messages to return (most recent)', default: 3 },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },

  // === Renderer Tools ===
  {
    category: 'renderer',
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current page.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Image format', enum: ['png', 'jpeg'], default: 'png' },
        full_page: { type: 'boolean', description: 'Capture full scrollable page', default: false },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },
  {
    category: 'renderer',
    name: 'renderer_evaluate',
    description: 'Evaluate arbitrary JavaScript in the renderer process. Does not require debugger pause.',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['expression'],
    },
  },

  // === V8 Inspector Tools (Main Process) ===
  {
    category: 'v8',
    name: 'v8_connect',
    description: 'Connect to a V8 Inspector endpoint on a running Electron main process.',
    inputSchema: {
      type: 'object',
      properties: {
        port: { type: 'number', description: 'V8 Inspector port (from --inspect=<port>)' },
        connection_id: { type: 'string', description: 'Connection ID', default: 'default' },
      },
      required: ['port'],
    },
  },
  {
    category: 'v8',
    name: 'v8_evaluate',
    description: 'Evaluate JavaScript in the Electron main process via V8 Inspector.',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        connection_id: { type: 'string', description: 'V8 connection to use' },
      },
      required: ['expression'],
    },
  },
  {
    category: 'v8',
    name: 'v8_disconnect',
    description: 'Disconnect a V8 Inspector connection.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'V8 connection to disconnect' },
      },
      required: ['connection_id'],
    },
  },
  {
    category: 'v8',
    name: 'v8_list_connections',
    description: 'List all V8 Inspector connections.',
    inputSchema: { type: 'object', properties: {} },
  },

  // === Network Monitoring ===
  {
    category: 'network',
    name: 'enable_network',
    description: 'Start capturing network requests for the current connection.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },
  {
    category: 'network',
    name: 'get_network_requests',
    description: 'List captured network requests with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        filter_status: { type: 'string', description: 'Filter: "all", "2xx", "3xx", "4xx", "5xx"', default: 'all' },
        resource_type: { type: 'string', description: 'Filter by type: "Document", "Script", "XHR", "Fetch", etc.' },
        limit: { type: 'number', description: 'Max requests to return (most recent)', default: 50 },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },
  {
    category: 'network',
    name: 'clear_network_requests',
    description: 'Clear captured network requests.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },

  // === Debugger Tools ===
  {
    category: 'debugger',
    name: 'enable_debug_tools',
    description: 'Enable JavaScript debugger. Must be called before breakpoints or stepping.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },
  {
    category: 'debugger',
    name: 'breakpoint',
    description: 'Set or remove breakpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '"set" or "remove"', enum: ['set', 'remove'] },
        url: { type: 'string', description: 'Script URL (for set)' },
        line_number: { type: 'number', description: 'Line number, 1-indexed (for set)' },
        column_number: { type: 'number', description: 'Column number, 0-indexed (for set)', default: 0 },
        condition: { type: 'string', description: 'Conditional expression (for set)' },
        breakpoint_id: { type: 'string', description: 'Breakpoint ID (for remove)' },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['action'],
    },
  },
  {
    category: 'debugger',
    name: 'step',
    description: 'Step through code execution when paused.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', description: '"over", "into", or "out"', enum: ['over', 'into', 'out'] },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['direction'],
    },
  },
  {
    category: 'debugger',
    name: 'execution',
    description: 'Resume or pause execution.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '"resume" or "pause"', enum: ['resume', 'pause'] },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['action'],
    },
  },
  {
    category: 'debugger',
    name: 'call_stack',
    description: 'Get the current call stack when execution is paused.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
    },
  },
  {
    category: 'debugger',
    name: 'evaluate',
    description: 'Evaluate JavaScript in a specific call frame. Only works when paused.',
    inputSchema: {
      type: 'object',
      properties: {
        call_frame_id: { type: 'string', description: 'Call frame ID from call_stack()' },
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['call_frame_id', 'expression'],
    },
  },
  {
    category: 'debugger',
    name: 'pause_on_exceptions',
    description: 'Configure whether to pause when exceptions are thrown.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: '"none", "uncaught", or "all"', enum: ['none', 'uncaught', 'all'] },
        connection_id: { type: 'string', description: 'Chrome connection to use' },
      },
      required: ['state'],
    },
  },

  // === Help / Tool Management ===
  {
    category: 'admin',
    name: 'help',
    description: 'Show install instructions for Electric Cherry across different tools.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    category: 'admin',
    name: 'hide_tools',
    description: 'Hide tools by pattern or specific names.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Pattern to match tool names (e.g., "chrome_*")' },
        tools: { type: 'array', description: 'Specific tool names to hide', items: { type: 'string' } },
      },
    },
  },
  {
    category: 'admin',
    name: 'show_tools',
    description: 'Show (restore) hidden tools.',
    inputSchema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Restore all hidden tools' },
        tools: { type: 'array', description: 'Specific tool names to restore', items: { type: 'string' } },
      },
    },
  },
];
