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

// [LAW:one-source-of-truth] Catalog content lives in tool-catalog.ts so the
// gh-pages showcase site can import the same data the MCP server registers.
import { TOOL_CATALOG } from './tool-catalog.js';

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
 * Unified tool definitions — 30 tools total. Catalog content lives in
 * `./tool-catalog.ts` so the showcase site can render the same data.
 */
const tools: Tool[] = TOOL_CATALOG as unknown as Tool[];

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
