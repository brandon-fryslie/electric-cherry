/**
 * Browser & Connection Management for Electric Cherry MCP
 * Ported from Python CDPConnectionManager
 *
 * Manages multiple Chrome connections via Puppeteer.
 * Each connection has its own Browser, Page, and CDP session.
 */

import puppeteer from 'puppeteer';
import type { Browser, Page, CDPSession } from 'puppeteer';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { join } from 'path';

import { DEBUG, CHROME_LAUNCH_WAIT, MAX_NETWORK_REQUESTS } from './config.js';
import type {
  Connection,
  ConnectionStatus,
  DebuggerPausedEvent,
  BreakpointInfo,
  ConsoleMessage,
  NetworkRequest,
} from './types.js';

/**
 * Log debug messages to stderr
 */
function debug(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Log info messages to stderr
 */
function info(message: string): void {
  console.error(`[INFO] ${message}`);
}

/**
 * Get platform-specific Chrome executable path
 */
function getChromePath(): string {
  switch (process.platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'linux':
      return 'google-chrome';
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Browser Manager - handles multiple Chrome connections
 * Ported from Python CDPConnectionManager
 */
export class BrowserManager {
  private connections: Map<string, Connection> = new Map();
  private activeConnectionId: string | null = null;
  private hiddenTools: Set<string> = new Set();

  /**
   * Connect to an existing Chrome instance running with remote debugging.
   *
   * @param connectionId - Unique identifier for this connection
   * @param host - Chrome host (default: localhost)
   * @param port - Chrome remote debugging port (default: 9222)
   * @returns Success message
   */
  async connect(
    connectionId: string,
    host = 'localhost',
    port = 9222
  ): Promise<string> {
    debug(`Connecting to Chrome at ${host}:${port} with ID: ${connectionId}`);

    if (this.connections.has(connectionId)) {
      return `Error: Connection '${connectionId}' already exists. Use chrome_disconnect first.`;
    }

    try {
      const browserURL = `http://${host}:${port}`;
      info(`Connecting to ${browserURL}...`);

      // First fetch the WebSocket URL from the debug endpoint
      const versionResponse = await fetch(`${browserURL}/json/version`);
      if (!versionResponse.ok) {
        throw new Error(`Failed to fetch browser info: ${versionResponse.status}`);
      }
      const versionInfo = await versionResponse.json() as { webSocketDebuggerUrl: string };
      const browserWsUrl = versionInfo.webSocketDebuggerUrl;
      info(`Got WebSocket URL: ${browserWsUrl}`);

      // Connect using WebSocket URL directly (more compatible with Electron)
      const browser = await puppeteer.connect({
        browserWSEndpoint: browserWsUrl,
        defaultViewport: null,
        protocolTimeout: 5000, // 5 second timeout
      });

      info(`Connected to browser, getting pages...`);

      // Get the first page or create one
      const pages = await browser.pages();
      const page = pages[0] || (await browser.newPage());

      // Get WebSocket URL
      const wsUrl = browser.wsEndpoint();

      // Create connection object
      const connection: Connection = {
        browser,
        page,
        cdpSession: null,
        wsUrl,
        pausedData: null,
        breakpoints: new Map(),
        debuggerEnabled: false,
        consoleLogs: [],
        consoleEnabled: true,
        networkRequests: [],
        networkEnabled: false,
      };

      // Set up console capture via page events (always enabled)
      page.on('console', (msg) => {
        const logEntry: ConsoleMessage = {
          level: msg.type(),
          text: msg.text(),
          timestamp: Date.now(),
          url: msg.location().url || undefined,
          lineNumber: msg.location().lineNumber,
        };
        connection.consoleLogs.push(logEntry);
        debug(`Console [${logEntry.level}]: ${logEntry.text}`);
      });

      this.connections.set(connectionId, connection);

      // Set as active if first connection
      if (this.activeConnectionId === null) {
        this.activeConnectionId = connectionId;
        debug(`Set '${connectionId}' as active connection`);
      }

      info(`Connected to Chrome at ${host}:${port} (ID: ${connectionId})`);
      return `Connected to Chrome at ${host}:${port} (ID: ${connectionId})`;
    } catch (error) {
      const errorMsg = `Failed to connect to Chrome at ${host}:${port}: ${error}`;
      debug(errorMsg);
      throw new Error(
        `${errorMsg}\n\nMake sure Chrome is running with:\nchrome --remote-debugging-port=${port}`
      );
    }
  }

  /**
   * Launch a new Chrome instance with remote debugging.
   *
   * @param debugPort - Remote debugging port
   * @param headless - Run in headless mode
   * @param userDataDir - Custom user data directory
   * @param extraArgs - Additional Chrome flags
   * @param connectionId - Connection ID (auto-generated if 'auto')
   * @returns Success message with process details
   */
  async launch(
    debugPort = 9222,
    headless = false,
    userDataDir?: string,
    extraArgs?: string,
    connectionId = 'auto'
  ): Promise<string> {
    debug(`Launching Chrome on port ${debugPort}`);

    // Auto-generate connection ID
    const finalConnectionId =
      connectionId === 'auto' ? `chrome-${debugPort}` : connectionId;

    if (this.connections.has(finalConnectionId)) {
      return `Error: Connection '${finalConnectionId}' already exists. Use chrome_disconnect first.`;
    }

    try {
      const chromePath = getChromePath();
      debug(`Chrome path: ${chromePath}`);

      // Create temp user data dir if not specified
      const finalUserDataDir =
        userDataDir || mkdtempSync(join(tmpdir(), 'chrome-debug-'));

      // Build command args
      const args: string[] = [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${finalUserDataDir}`,
        // Skip first-run setup and dialogs
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        // Privacy sandbox / tracking prompts
        '--disable-features=PrivacySandboxSettings4,TrackingProtection3pcd',
      ];

      if (headless) {
        args.push('--headless=new');
      }

      if (extraArgs) {
        args.push(...extraArgs.split(' '));
      }

      debug(`Launching Chrome with args: ${args.join(' ')}`);

      // Launch Chrome process
      const chromeProcess = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
      });

      chromeProcess.unref();

      info(`Chrome launched with PID: ${chromeProcess.pid}`);

      // Wait for Chrome to start
      await sleep(CHROME_LAUNCH_WAIT);

      // Connect to the launched instance
      try {
        await this.connect(finalConnectionId, 'localhost', debugPort);

        return `Chrome launched successfully

Process ID: ${chromeProcess.pid}
Debug Port: ${debugPort}
Connection ID: ${finalConnectionId}

Use chrome_list_connections() to see all connections.`;
      } catch (connectError) {
        return `Chrome launched (PID: ${chromeProcess.pid}) but connection failed: ${connectError}

Try chrome(action="connect", port=${debugPort}, connection_id="${finalConnectionId}") manually after a few seconds.`;
      }
    } catch (error) {
      throw new Error(`Failed to launch Chrome: ${error}`);
    }
  }

  /**
   * Disconnect from a specific Chrome instance.
   *
   * @param connectionId - ID of connection to disconnect
   * @returns Success message
   */
  async disconnect(connectionId: string): Promise<string> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return `Error: Connection '${connectionId}' not found`;
    }

    try {
      // Clean up CDP session
      if (connection.cdpSession) {
        await connection.cdpSession.detach();
      }

      // Disconnect browser (don't close - it might be shared)
      connection.browser.disconnect();

      this.connections.delete(connectionId);

      // Switch active if we disconnected the active one
      if (this.activeConnectionId === connectionId) {
        this.activeConnectionId = this.connections.keys().next().value || null;
        if (this.activeConnectionId) {
          debug(`Switched active to '${this.activeConnectionId}'`);
        }
      }

      return `Disconnected from '${connectionId}'`;
    } catch (error) {
      return `Error disconnecting: ${error}`;
    }
  }

  /**
   * Disconnect all Chrome instances.
   */
  async disconnectAll(): Promise<void> {
    for (const [id] of this.connections) {
      await this.disconnect(id);
    }
  }

  /**
   * Get the active connection.
   *
   * @returns Active Connection or null
   */
  getActive(): Connection | null {
    if (this.activeConnectionId) {
      return this.connections.get(this.activeConnectionId) || null;
    }
    return null;
  }

  /**
   * Get a specific connection by ID.
   *
   * @param connectionId - Connection ID
   * @returns Connection or null
   */
  get(connectionId: string): Connection | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get connection by ID or active connection if ID is null.
   *
   * @param connectionId - Optional connection ID
   * @returns Connection or null
   */
  getConnection(connectionId?: string): Connection | null {
    if (connectionId) {
      return this.get(connectionId);
    }
    return this.getActive();
  }

  /**
   * Switch the active connection.
   *
   * @param connectionId - ID of connection to make active
   * @returns Success message
   */
  switchActive(connectionId: string): string {
    if (!this.connections.has(connectionId)) {
      return `Error: Connection '${connectionId}' not found`;
    }

    this.activeConnectionId = connectionId;
    return `Switched to connection '${connectionId}'`;
  }

  /**
   * List all connections with their status.
   *
   * @returns Map of connection IDs to status
   */
  listConnections(): Map<string, ConnectionStatus> {
    const result = new Map<string, ConnectionStatus>();

    for (const [id, conn] of this.connections) {
      result.set(id, {
        url: conn.wsUrl,
        active: id === this.activeConnectionId,
        paused: conn.pausedData !== null,
        debuggerEnabled: conn.debuggerEnabled,
      });
    }

    return result;
  }

  /**
   * Get active connection ID.
   */
  getActiveId(): string | null {
    return this.activeConnectionId;
  }

  /**
   * Check if any connections exist.
   */
  hasConnections(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Enable debugger for a connection and set up CDP session.
   *
   * @param connectionId - Optional connection ID
   * @returns CDP session
   */
  async enableDebugger(connectionId?: string): Promise<CDPSession> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      const id = connectionId || 'active';
      throw new Error(
        `No Chrome connection '${id}' found. Use chrome(action="connect", ...) or chrome(action="launch", ...) first.`
      );
    }

    // Create CDP session if not exists
    if (!connection.cdpSession) {
      const client = await connection.page.createCDPSession();
      connection.cdpSession = client;

      // Set up event handlers
      client.on('Debugger.paused', (params) => {
        // Cast to our type - CDP types are compatible
        connection.pausedData = params as unknown as DebuggerPausedEvent;
        debug(`Debugger paused: ${params.reason}`);
      });

      client.on('Debugger.resumed', () => {
        connection.pausedData = null;
        debug('Debugger resumed');
      });
    }

    // Enable debugger if not already
    if (!connection.debuggerEnabled) {
      await connection.cdpSession.send('Debugger.enable');
      connection.debuggerEnabled = true;
      debug('Debugger enabled');
    }

    return connection.cdpSession;
  }

  /**
   * Get CDP session for a connection (must call enableDebugger first).
   *
   * @param connectionId - Optional connection ID
   * @returns CDP session or null
   */
  getCdpSession(connectionId?: string): CDPSession | null {
    const connection = this.getConnection(connectionId);
    return connection?.cdpSession || null;
  }

  /**
   * Store breakpoint info.
   */
  storeBreakpoint(
    connectionId: string | undefined,
    breakpointId: string,
    info: BreakpointInfo
  ): void {
    const connection = this.getConnection(connectionId);
    if (connection) {
      connection.breakpoints.set(breakpointId, info);
    }
  }

  /**
   * Remove breakpoint info.
   */
  removeBreakpoint(connectionId: string | undefined, breakpointId: string): void {
    const connection = this.getConnection(connectionId);
    if (connection) {
      connection.breakpoints.delete(breakpointId);
    }
  }

  /**
   * Get paused data for call stack retrieval.
   */
  getPausedData(connectionId?: string): DebuggerPausedEvent | null {
    const connection = this.getConnection(connectionId);
    return connection?.pausedData || null;
  }

  /**
   * Check if execution is paused.
   */
  isPaused(connectionId?: string): boolean {
    return this.getPausedData(connectionId) !== null;
  }

  /**
   * Get console logs for a connection.
   *
   * @param connectionId - Optional connection ID
   * @param filterLevel - Filter by level ('all', 'error', 'warning', 'info', 'debug', 'log')
   * @returns Array of console messages
   */
  getConsoleLogs(connectionId?: string, filterLevel = 'all'): ConsoleMessage[] {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return [];
    }

    if (filterLevel === 'all') {
      return connection.consoleLogs;
    }

    // Map filter level to console types
    const levelMap: Record<string, string[]> = {
      error: ['error'],
      warning: ['warning', 'warn'],
      info: ['info'],
      debug: ['debug'],
      log: ['log'],
    };

    const matchLevels = levelMap[filterLevel] || [filterLevel];
    return connection.consoleLogs.filter((msg) => matchLevels.includes(msg.level));
  }

  /**
   * Clear console logs for a connection.
   */
  clearConsoleLogs(connectionId?: string): void {
    const connection = this.getConnection(connectionId);
    if (connection) {
      connection.consoleLogs = [];
    }
  }

  /**
   * Enable network request monitoring for a connection via CDP Network domain.
   * Reuses existing CDP session or creates one.
   */
  async enableNetworkMonitoring(connectionId?: string): Promise<string> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      const id = connectionId || 'active';
      throw new Error(
        `No Chrome connection '${id}' found. Use chrome(action="connect", ...) or chrome(action="launch", ...) first.`
      );
    }

    if (connection.networkEnabled) {
      return 'Network monitoring already enabled';
    }

    // Ensure CDP session exists (reuse enableDebugger pattern)
    if (!connection.cdpSession) {
      connection.cdpSession = await connection.page.createCDPSession();
    }

    await connection.cdpSession.send('Network.enable');
    connection.networkEnabled = true;

    // Track in-flight requests before response arrives
    const pendingRequests = new Map<string, NetworkRequest>();

    connection.cdpSession.on('Network.requestWillBeSent', (params: {
      requestId: string;
      request: { url: string; method: string };
      type?: string;
    }) => {
      const req: NetworkRequest = {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        status: null,
        mimeType: null,
        timestamp: Date.now(),
        resourceType: params.type ?? 'Other',
        encodedDataLength: null,
      };
      pendingRequests.set(params.requestId, req);
    });

    connection.cdpSession.on('Network.responseReceived', (params: {
      requestId: string;
      response: { status: number; mimeType: string };
    }) => {
      const req = pendingRequests.get(params.requestId);
      if (req) {
        req.status = params.response.status;
        req.mimeType = params.response.mimeType;
      }
    });

    connection.cdpSession.on('Network.loadingFinished', (params: {
      requestId: string;
      encodedDataLength: number;
    }) => {
      const req = pendingRequests.get(params.requestId);
      if (req) {
        req.encodedDataLength = params.encodedDataLength;
        pendingRequests.delete(params.requestId);
        // Cap at MAX_NETWORK_REQUESTS — drop oldest
        if (connection.networkRequests.length >= MAX_NETWORK_REQUESTS) {
          connection.networkRequests.shift();
        }
        connection.networkRequests.push(req);
      }
    });

    // Also capture failed requests
    connection.cdpSession.on('Network.loadingFailed', (params: {
      requestId: string;
    }) => {
      const req = pendingRequests.get(params.requestId);
      if (req) {
        if (req.status === null) req.status = 0; // Mark as failed
        pendingRequests.delete(params.requestId);
        if (connection.networkRequests.length >= MAX_NETWORK_REQUESTS) {
          connection.networkRequests.shift();
        }
        connection.networkRequests.push(req);
      }
    });

    return 'Network monitoring enabled';
  }

  /**
   * Get captured network requests for a connection.
   */
  getNetworkRequests(connectionId?: string): NetworkRequest[] {
    const connection = this.getConnection(connectionId);
    return connection?.networkRequests ?? [];
  }

  /**
   * Clear captured network requests for a connection.
   */
  clearNetworkRequests(connectionId?: string): void {
    const connection = this.getConnection(connectionId);
    if (connection) {
      connection.networkRequests = [];
    }
  }

  /**
   * Switch to a different page within a connection.
   * Sets up console listeners on the new page.
   */
  async switchPage(connectionId: string | undefined, newPage: Page): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error('No connection found');
    }

    // Update page reference
    connection.page = newPage;

    // Clear old console logs and set up listener on new page
    connection.consoleLogs = [];
    newPage.on('console', (msg) => {
      const logEntry: ConsoleMessage = {
        level: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        url: msg.location().url || undefined,
        lineNumber: msg.location().lineNumber,
      };
      connection.consoleLogs.push(logEntry);
      debug(`Console [${logEntry.level}]: ${logEntry.text}`);
    });

    // Reset CDP session (will be recreated when debugger is enabled)
    if (connection.cdpSession) {
      try {
        await connection.cdpSession.detach();
      } catch {
        // Ignore detach errors
      }
      connection.cdpSession = null;
      connection.debuggerEnabled = false;
    }

    info(`Switched to page: ${newPage.url()}`);
  }

  /**
   * Hide tools by pattern or specific tool names.
   * Hidden tools won't appear in tool lists until restored.
   *
   * @param pattern - Pattern to match tool names (e.g., "chrome_*")
   * @param tools - Array of specific tool names to hide
   * @returns Number of tools hidden
   */
  hideTools(pattern?: string, tools?: string[]): number {
    let hiddenCount = 0;

    if (pattern) {
      // Convert pattern to regex (simple * wildcard support)
      const regexPattern = pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);

      // We'll apply this filter in the ListToolsRequestSchema handler
      // For now, just store the pattern
      this.hiddenTools.add(pattern);
      hiddenCount++;
    }

    if (tools && tools.length > 0) {
      for (const tool of tools) {
        this.hiddenTools.add(tool);
        hiddenCount++;
      }
    }

    return hiddenCount;
  }

  /**
   * Show (restore) hidden tools.
   *
   * @param all - Restore all hidden tools
   * @param tools - Array of specific tool names to restore
   * @returns Number of tools restored
   */
  showTools(all?: boolean, tools?: string[]): number {
    let restoredCount = 0;

    if (all) {
      restoredCount = this.hiddenTools.size;
      this.hiddenTools.clear();
    } else if (tools && tools.length > 0) {
      for (const tool of tools) {
        if (this.hiddenTools.delete(tool)) {
          restoredCount++;
        }
      }
    }

    return restoredCount;
  }

  /**
   * Check if a tool should be hidden based on hidden patterns.
   *
   * @param toolName - Tool name to check
   * @returns True if tool should be hidden
   */
  isToolHidden(toolName: string): boolean {
    // Check exact match first
    if (this.hiddenTools.has(toolName)) {
      return true;
    }

    // Check pattern matches
    for (const pattern of this.hiddenTools) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(toolName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if debugger is enabled for active connection.
   */
  isDebuggerEnabled(connectionId?: string): boolean {
    const connection = this.getConnection(connectionId);
    return connection?.debuggerEnabled ?? false;
  }
}

// Global browser manager instance
export const browserManager = new BrowserManager();
