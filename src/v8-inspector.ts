/**
 * V8 Inspector Protocol client for Electron main process debugging.
 *
 * Connects to Electron's --inspect=<port> via native WebSocket and
 * sends JSON-RPC commands (Runtime.evaluate).
 *
 * [LAW:one-way-deps] This module depends only on config.ts and types.ts.
 * It never imports from browser.ts or tools/*.
 */

import { V8_CONNECT_TIMEOUT, V8_REQUEST_TIMEOUT } from './config.js';
import type { V8Connection } from './types.js';

/**
 * Format a V8 Runtime.evaluate result for display.
 */
function formatEvalResult(result: Record<string, unknown>): string {
  const evalResult = result.result as Record<string, unknown> | undefined;
  const exceptionDetails = result.exceptionDetails as Record<string, unknown> | undefined;

  if (exceptionDetails) {
    const exception = exceptionDetails.exception as Record<string, unknown> | undefined;
    const text = exceptionDetails.text as string ?? 'Unknown error';
    const description = exception?.description as string | undefined;
    return `Exception: ${description ?? text}`;
  }

  if (!evalResult) {
    return 'undefined';
  }

  const type = evalResult.type as string;
  const subtype = evalResult.subtype as string | undefined;
  const value = evalResult.value;
  const description = evalResult.description as string | undefined;

  // Primitives with value come back directly
  if (value !== undefined) {
    return JSON.stringify(value, null, 2);
  }

  // Objects without returnByValue show description
  if (description) {
    return description;
  }

  if (subtype === 'null') {
    return 'null';
  }

  return `[${type}${subtype ? `:${subtype}` : ''}]`;
}

/**
 * V8 Inspector Protocol client.
 * Manages WebSocket connections to V8 Inspector endpoints.
 */
export class V8InspectorClient {
  private connections: Map<string, V8Connection> = new Map();
  private activeConnectionId: string | null = null;

  /**
   * Connect to a V8 Inspector endpoint.
   *
   * @param connectionId - Unique identifier for this connection
   * @param port - V8 Inspector port (from --inspect=<port>)
   */
  async connect(connectionId: string, port: number): Promise<string> {
    if (this.connections.has(connectionId)) {
      return `Error: V8 connection '${connectionId}' already exists. Use v8_disconnect first.`;
    }

    // Fetch the WebSocket URL from the inspector's /json endpoint
    const listUrl = `http://localhost:${port}/json`;
    let wsUrl: string;

    try {
      const response = await fetch(listUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const targets = await response.json() as Array<{ webSocketDebuggerUrl?: string }>;
      const target = targets[0];
      if (!target?.webSocketDebuggerUrl) {
        throw new Error('No debuggable target found');
      }
      wsUrl = target.webSocketDebuggerUrl;
    } catch (error) {
      throw new Error(
        `Failed to fetch V8 Inspector targets at ${listUrl}: ${error}\n\n` +
        `Make sure the Electron app is running with --inspect=${port}`
      );
    }

    // Open native WebSocket connection
    const ws = new WebSocket(wsUrl);
    const conn: V8Connection = {
      ws,
      port,
      pendingRequests: new Map(),
      nextId: 1,
    };

    // Wait for connection to open (or fail)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`V8 Inspector connection timed out after ${V8_CONNECT_TIMEOUT}ms`));
      }, V8_CONNECT_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      ws.onerror = (event) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error connecting to ${wsUrl}: ${event}`));
      };
    });

    // Route incoming messages to pending request handlers
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { id?: number; result?: unknown; error?: { message: string } };
        if (msg.id !== undefined) {
          const pending = conn.pendingRequests.get(msg.id);
          if (pending) {
            conn.pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message));
            } else {
              pending.resolve(msg.result);
            }
          }
        }
        // Events (no id) are ignored — no breakpoints/stepping in V8 Inspector yet
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onclose = () => {
      // Clean up pending requests on unexpected close
      for (const [, pending] of conn.pendingRequests) {
        pending.reject(new Error('V8 Inspector connection closed'));
      }
      conn.pendingRequests.clear();
    };

    this.connections.set(connectionId, conn);

    if (this.activeConnectionId === null) {
      this.activeConnectionId = connectionId;
    }

    return `Connected to V8 Inspector at localhost:${port} (ID: ${connectionId})`;
  }

  /**
   * Evaluate a JavaScript expression in the Electron main process.
   */
  async evaluate(expression: string, connectionId?: string): Promise<string> {
    const conn = this.getConnection(connectionId);
    if (!conn) {
      const id = connectionId ?? 'active';
      throw new Error(
        `No V8 connection '${id}' found. Use v8_connect() or electron_connect() first.`
      );
    }

    // Check WebSocket is still open (readyState 1 = OPEN)
    if (conn.ws.readyState !== 1) {
      throw new Error('V8 Inspector WebSocket is not open. Reconnect with v8_connect().');
    }

    const id = conn.nextId++;

    const result = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pendingRequests.delete(id);
        reject(new Error(`V8 evaluate timed out after ${V8_REQUEST_TIMEOUT}ms`));
      }, V8_REQUEST_TIMEOUT);

      conn.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      conn.ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
      }));
    });

    return formatEvalResult(result as Record<string, unknown>);
  }

  /**
   * Disconnect a V8 Inspector connection.
   */
  disconnect(connectionId: string): string {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return `Error: V8 connection '${connectionId}' not found`;
    }

    conn.ws.close();
    for (const [, pending] of conn.pendingRequests) {
      pending.reject(new Error('Disconnected'));
    }
    conn.pendingRequests.clear();
    this.connections.delete(connectionId);

    if (this.activeConnectionId === connectionId) {
      this.activeConnectionId = this.connections.keys().next().value ?? null;
    }

    return `Disconnected V8 Inspector '${connectionId}'`;
  }

  /**
   * List all V8 Inspector connections.
   */
  listConnections(): Array<{ id: string; port: number; active: boolean; connected: boolean }> {
    const result: Array<{ id: string; port: number; active: boolean; connected: boolean }> = [];
    for (const [id, conn] of this.connections) {
      result.push({
        id,
        port: conn.port,
        active: id === this.activeConnectionId,
        connected: conn.ws.readyState === 1,
      });
    }
    return result;
  }

  /**
   * Get connection by ID or active connection.
   */
  private getConnection(connectionId?: string): V8Connection | null {
    if (connectionId) {
      return this.connections.get(connectionId) ?? null;
    }
    if (this.activeConnectionId) {
      return this.connections.get(this.activeConnectionId) ?? null;
    }
    return null;
  }
}

// [LAW:one-type-per-behavior] Single class, single instance
export const v8Inspector = new V8InspectorClient();
