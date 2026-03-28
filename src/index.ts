#!/usr/bin/env node

/**
 * Electric Cherry MCP Server
 *
 * Electron debugging MCP server: renderer (CDP) + main process (V8 Inspector)
 * with app discovery, screenshots, network monitoring, and JS evaluation.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

import {
  // Chrome connection (consolidated)
  chrome,
  chromeListConnections,
  chromeSwitchConnection,
  chromeDisconnect,
  target,
  enableDebugTools,
  hideTools,
  showTools,
  // DOM
  queryElements,
  clickElement,
  fillElement,
  navigate,
  getConsoleLogs,
  // Debugger (consolidated)
  step,
  execution,
  breakpoint,
  callStack,
  evaluate,
  pauseOnExceptions,
  // Electron
  electronSetup,
  electronConnect,
  // Renderer
  takeScreenshot,
  rendererEvaluate,
  // V8 Inspector
  v8Connect,
  v8Evaluate,
  v8Disconnect,
  v8ListConnections,
  // Network
  enableNetwork,
  getNetworkRequests,
  clearNetworkRequests,
  // Help
  help,
} from './tools/index.js';

const server = new Server(
  {
    name: 'electric-cherry',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Unified tool definitions — 30 tools total
 */
const tools: Tool[] = [
  // === Electron App Discovery ===
  {
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
    name: 'chrome_list_connections',
    description: 'List all active Chrome connections with their status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
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
    name: 'v8_list_connections',
    description: 'List all V8 Inspector connections.',
    inputSchema: { type: 'object', properties: {} },
  },

  // === Network Monitoring ===
  {
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

  // === Help ===
  {
    name: 'help',
    description: 'Show install instructions for Electric Cherry across different tools.',
    inputSchema: { type: 'object', properties: {} },
  },

  // === Tool Management ===
  {
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

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution — single switch block, no branching
// [LAW:single-enforcer] All tool routing happens here
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // Electron
      case 'electron_setup':
        return await electronSetup(args as Parameters<typeof electronSetup>[0]);
      case 'electron_connect':
        return await electronConnect(args as Parameters<typeof electronConnect>[0]);

      // Chrome connection
      case 'chrome':
        return await chrome(args as Parameters<typeof chrome>[0]);
      case 'chrome_list_connections':
        return await chromeListConnections();
      case 'chrome_switch_connection':
        return await chromeSwitchConnection(args as Parameters<typeof chromeSwitchConnection>[0]);
      case 'chrome_disconnect':
        return await chromeDisconnect(args as Parameters<typeof chromeDisconnect>[0]);
      case 'target':
        return await target(args as Parameters<typeof target>[0]);

      // DOM
      case 'query_elements':
        return await queryElements(args as Parameters<typeof queryElements>[0]);
      case 'click_element':
        return await clickElement(args as Parameters<typeof clickElement>[0]);
      case 'fill_element':
        return await fillElement(args as Parameters<typeof fillElement>[0]);
      case 'navigate':
        return await navigate(args as Parameters<typeof navigate>[0]);
      case 'get_console_logs':
        return await getConsoleLogs(args as Parameters<typeof getConsoleLogs>[0]);

      // Renderer
      case 'take_screenshot':
        return await takeScreenshot(args as Parameters<typeof takeScreenshot>[0]);
      case 'renderer_evaluate':
        return await rendererEvaluate(args as Parameters<typeof rendererEvaluate>[0]);

      // V8 Inspector
      case 'v8_connect':
        return await v8Connect(args as Parameters<typeof v8Connect>[0]);
      case 'v8_evaluate':
        return await v8Evaluate(args as Parameters<typeof v8Evaluate>[0]);
      case 'v8_disconnect':
        return await v8Disconnect(args as Parameters<typeof v8Disconnect>[0]);
      case 'v8_list_connections':
        return v8ListConnections();

      // Network
      case 'enable_network':
        return await enableNetwork(args as Parameters<typeof enableNetwork>[0]);
      case 'get_network_requests':
        return getNetworkRequests(args as Parameters<typeof getNetworkRequests>[0]);
      case 'clear_network_requests':
        return clearNetworkRequests(args as Parameters<typeof clearNetworkRequests>[0]);

      // Debugger
      case 'enable_debug_tools':
        return await enableDebugTools(args as Parameters<typeof enableDebugTools>[0]);
      case 'breakpoint':
        return await breakpoint(args as Parameters<typeof breakpoint>[0]);
      case 'step':
        return await step(args as Parameters<typeof step>[0]);
      case 'execution':
        return await execution(args as Parameters<typeof execution>[0]);
      case 'call_stack':
        return await callStack(args as Parameters<typeof callStack>[0]);
      case 'evaluate':
        return await evaluate(args as Parameters<typeof evaluate>[0]);
      case 'pause_on_exceptions':
        return await pauseOnExceptions(args as Parameters<typeof pauseOnExceptions>[0]);

      // Help
      case 'help':
        return help();

      // Tool management
      case 'hide_tools':
        return await hideTools(args as Parameters<typeof hideTools>[0]);
      case 'show_tools':
        return await showTools(args as Parameters<typeof showTools>[0]);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Electric Cherry MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
