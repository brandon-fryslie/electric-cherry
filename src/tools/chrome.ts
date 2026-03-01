/**
 * Chrome Connection Management Tools
 * Ported from Python chrome_connect, chrome_launch, etc.
 */

import { browserManager } from '../browser.js';
import { successResponse, errorResponse } from '../response.js';

/**
 * Connect to a Chrome instance running with remote debugging enabled.
 *
 * Chrome must be launched with --remote-debugging-port flag.
 * You can connect to multiple Chrome instances by specifying different connection_ids.
 */
export async function chromeConnect(args: {
  port?: number;
  connection_id?: string;
  host?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const port = args.port ?? 9222;
  const connectionId = args.connection_id ?? 'default';
  const host = args.host ?? 'localhost';

  console.error(`[electric-cherry] Connecting to ${host}:${port} as '${connectionId}'...`);

  try {
    const result = await browserManager.connect(connectionId, host, port);
    console.error(`[electric-cherry] Connection result: ${result}`);
    return successResponse(result || `Connected to Chrome at ${host}:${port} (ID: ${connectionId})`);
  } catch (error) {
    console.error(`[electric-cherry] Connection failed: ${error}`);
    return errorResponse(
      `Error connecting to Chrome: ${error}\n\nMake sure Chrome is running with:\nchrome --remote-debugging-port=${port}`
    );
  }
}

/**
 * Launch a new Chrome instance with remote debugging enabled.
 *
 * Automatically connects to the launched instance after startup.
 */
export async function chromeLaunch(args: {
  debug_port?: number;
  headless?: boolean;
  user_data_dir?: string;
  extra_args?: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const debugPort = args.debug_port ?? 9222;
  const headless = args.headless ?? false;
  const userDataDir = args.user_data_dir;
  const extraArgs = args.extra_args;
  const connectionId = args.connection_id ?? 'auto';

  try {
    const result = await browserManager.launch(
      debugPort,
      headless,
      userDataDir,
      extraArgs,
      connectionId
    );
    return successResponse(result);
  } catch (error) {
    return errorResponse(`Error launching Chrome: ${error}`);
  }
}

/**
 * CONSOLIDATED: chrome - Connect or launch Chrome
 *
 * Replaces chrome_connect and chrome_launch with a single tool.
 */
export async function chrome(args: {
  action: 'connect' | 'launch';
  port?: number;
  host?: string;
  connection_id?: string;
  headless?: boolean;
  user_data_dir?: string;
  extra_args?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.action === 'connect') {
    return chromeConnect({
      port: args.port,
      connection_id: args.connection_id,
      host: args.host,
    });
  } else if (args.action === 'launch') {
    return chromeLaunch({
      debug_port: args.port,
      headless: args.headless,
      user_data_dir: args.user_data_dir,
      extra_args: args.extra_args,
      connection_id: args.connection_id,
    });
  } else {
    return errorResponse(`Invalid action: ${args.action}. Must be 'connect' or 'launch'.`);
  }
}

/**
 * List all active Chrome connections.
 *
 * Shows connection ID, WebSocket URL, active status, and paused state for each connection.
 */
export async function chromeListConnections(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const connections = browserManager.listConnections();

  if (connections.size === 0) {
    return successResponse(
      'No active Chrome connections.\n\nUse chrome(action="connect", ...) or chrome(action="launch", ...) to create a connection.'
    );
  }

  const lines: string[] = ['Chrome Connections:', '='.repeat(80), ''];

  for (const [connId, info] of connections) {
    const marker = info.active ? '>>> ' : '    ';
    lines.push(`${marker}[${connId}]`);
    lines.push(`    URL: ${info.url}`);
    lines.push(`    Active: ${info.active}`);
    lines.push(`    Paused: ${info.paused}`);
    lines.push(`    Debugger: ${info.debuggerEnabled ? 'enabled' : 'disabled'}`);
    lines.push('');
  }

  if (connections.size > 1) {
    lines.push(
      'Use chrome_switch_connection(connection_id) to change the active connection.'
    );
  }
  lines.push('Use chrome_disconnect(connection_id) to close a connection.');

  return successResponse(lines.join('\n'));
}

/**
 * Switch the active Chrome connection.
 *
 * All debugger and DOM tools will use the active connection.
 */
export async function chromeSwitchConnection(args: {
  connection_id: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = browserManager.switchActive(args.connection_id);

  if (result.startsWith('Error')) {
    return errorResponse(result);
  }
  return successResponse(result);
}

/**
 * Disconnect from a specific Chrome instance.
 *
 * If you disconnect the active connection, the next available connection
 * will become active automatically.
 */
export async function chromeDisconnect(args: {
  connection_id: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const result = await browserManager.disconnect(args.connection_id);

    if (result.startsWith('Error')) {
      return errorResponse(result);
    }
    return successResponse(result);
  } catch (error) {
    return errorResponse(`Error disconnecting: ${error}`);
  }
}

/**
 * List all targets (pages, workers, service workers) for a connection.
 *
 * Shows which target is currently active. Use switch_target to change.
 */
export async function listTargets(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const connection = browserManager.getConnection(args.connection_id);
    if (!connection) {
      const id = args.connection_id || 'active';
      return errorResponse(
        `No Chrome connection '${id}' found. Use chrome(action="connect", ...) or chrome(action="launch", ...) first.`
      );
    }

    // Get the debug port from the WebSocket URL
    const wsUrl = connection.wsUrl;
    const portMatch = wsUrl.match(/:(\d+)\//);
    if (!portMatch) {
      return errorResponse('Could not determine debug port from connection');
    }
    const port = portMatch[1];

    // Fetch targets from CDP
    const response = await fetch(`http://localhost:${port}/json/list`);
    if (!response.ok) {
      return errorResponse(`Failed to list targets: ${response.status}`);
    }

    const targets = await response.json() as Array<{
      id: string;
      type: string;
      title: string;
      url: string;
      webSocketDebuggerUrl?: string;
    }>;

    if (targets.length === 0) {
      return successResponse('No targets found.');
    }

    // Get current page's target ID to mark as active
    const currentUrl = connection.page.url();

    const lines: string[] = [];
    const connId = args.connection_id || browserManager.getActiveId() || 'unknown';
    lines.push(`Targets for connection '${connId}':`);
    lines.push('');

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const isActive = t.url === currentUrl;
      const marker = isActive ? '>>> ' : '    ';
      const activeLabel = isActive ? ' (active)' : '';

      lines.push(`${marker}[${i}] ${t.type}: "${t.title || '(untitled)'}"${activeLabel}`);
      lines.push(`        ${t.url.substring(0, 70)}${t.url.length > 70 ? '...' : ''}`);
    }

    lines.push('');
    lines.push('Use switch_target(index) or switch_target(title="...") to change target.');

    return successResponse(lines.join('\n'));
  } catch (error) {
    return errorResponse(`Error listing targets: ${error}`);
  }
}

/**
 * Switch to a different target (page, worker) within the current connection.
 *
 * Can switch by index number, title pattern, or URL pattern.
 */
export async function switchTarget(args: {
  index?: number;
  title?: string;
  url?: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const connection = browserManager.getConnection(args.connection_id);
    if (!connection) {
      const id = args.connection_id || 'active';
      return errorResponse(
        `No Chrome connection '${id}' found. Use chrome(action="connect", ...) or chrome(action="launch", ...) first.`
      );
    }

    // Get the debug port from the WebSocket URL
    const wsUrl = connection.wsUrl;
    const portMatch = wsUrl.match(/:(\d+)\//);
    if (!portMatch) {
      return errorResponse('Could not determine debug port from connection');
    }
    const port = portMatch[1];

    // Fetch targets from CDP
    const response = await fetch(`http://localhost:${port}/json/list`);
    if (!response.ok) {
      return errorResponse(`Failed to list targets: ${response.status}`);
    }

    const targets = await response.json() as Array<{
      id: string;
      type: string;
      title: string;
      url: string;
      webSocketDebuggerUrl?: string;
    }>;

    // Find the target
    let target: typeof targets[0] | undefined;
    let matchDesc: string;

    if (args.index !== undefined) {
      if (args.index < 0 || args.index >= targets.length) {
        return errorResponse(`Index ${args.index} out of range. Found ${targets.length} targets.`);
      }
      target = targets[args.index];
      matchDesc = `index ${args.index}`;
    } else if (args.title) {
      const pattern = args.title.toLowerCase();
      target = targets.find(t => t.title.toLowerCase().includes(pattern));
      matchDesc = `title "${args.title}"`;
    } else if (args.url) {
      const pattern = args.url.toLowerCase().replace(/\*/g, '.*');
      const regex = new RegExp(pattern);
      target = targets.find(t => regex.test(t.url.toLowerCase()));
      matchDesc = `url "${args.url}"`;
    } else {
      return errorResponse('Must specify index, title, or url to switch target.');
    }

    if (!target) {
      return errorResponse(`No target found matching ${matchDesc}`);
    }

    if (target.type !== 'page') {
      return errorResponse(
        `Target "${target.title}" is a ${target.type}, not a page. Can only switch to page targets.`
      );
    }

    // Switch to the new page using browser.pages()
    const pages = await connection.browser.pages();
    const newPage = pages.find(p => p.url() === target!.url);

    if (!newPage) {
      return errorResponse(
        `Could not find page for target "${target.title}". It may have closed.`
      );
    }

    // Update connection's page reference
    await browserManager.switchPage(args.connection_id, newPage);

    return successResponse(
      `Switched to: "${target.title}"\n${target.url.substring(0, 80)}${target.url.length > 80 ? '...' : ''}`
    );
  } catch (error) {
    return errorResponse(`Error switching target: ${error}`);
  }
}

/**
 * CONSOLIDATED: target - List or switch targets (pages)
 *
 * Replaces list_targets and switch_target with a single tool.
 */
export async function target(args: {
  action: 'list' | 'switch';
  index?: number;
  title?: string;
  url?: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.action === 'list') {
    return listTargets({
      connection_id: args.connection_id,
    });
  } else if (args.action === 'switch') {
    return switchTarget({
      index: args.index,
      title: args.title,
      url: args.url,
      connection_id: args.connection_id,
    });
  } else {
    return errorResponse(`Invalid action: ${args.action}. Must be 'list' or 'switch'.`);
  }
}

/**
 * META TOOL: Enable debug tools
 *
 * Shows debugger tools by enabling the debugger.
 * This provides semantic intent for showing debugging capabilities.
 */
export async function enableDebugTools(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    await browserManager.enableDebugger(args.connection_id);

    return successResponse(
      `Debug tools enabled successfully

You can now:
- Set breakpoints with breakpoint(action="set", ...)
- Pause execution with execution(action="pause")
- Configure exception breaking with pause_on_exceptions(...)`
    );
  } catch (error) {
    return errorResponse(`Error enabling debug tools: ${error}`);
  }
}

/**
 * META TOOL: Hide tools by pattern
 *
 * Hides tools matching the specified name or pattern.
 * Hidden tools won't appear in tool lists until restored with show_tools.
 */
export async function hideTools(args: {
  pattern?: string;
  tools?: string[];
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const hiddenCount = browserManager.hideTools(args.pattern, args.tools);

    return successResponse(
      `Hidden ${hiddenCount} tool(s).

Use show_tools(all=true) to restore all hidden tools.`
    );
  } catch (error) {
    return errorResponse(`Error hiding tools: ${error}`);
  }
}

/**
 * META TOOL: Show hidden tools
 *
 * Restores hidden tools either all at once or by specific list.
 */
export async function showTools(args: {
  all?: boolean;
  tools?: string[];
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const restoredCount = browserManager.showTools(args.all, args.tools);

    return successResponse(
      `Restored ${restoredCount} tool(s).`
    );
  } catch (error) {
    return errorResponse(`Error showing tools: ${error}`);
  }
}
