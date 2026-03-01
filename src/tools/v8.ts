/**
 * V8 Inspector tools — evaluate JS in Electron main process.
 *
 * [LAW:one-way-deps] Depends on v8-inspector.ts, response.ts only.
 */

import { v8Inspector } from '../v8-inspector.js';
import { successResponse, errorResponse } from '../response.js';
import type { ToolResult } from '../types.js';

/**
 * Connect to a V8 Inspector endpoint on a running Electron app.
 */
export async function v8Connect(args: {
  port: number;
  connection_id?: string;
}): Promise<ToolResult> {
  const connectionId = args.connection_id ?? 'default';

  try {
    const result = await v8Inspector.connect(connectionId, args.port);
    return successResponse(result);
  } catch (error) {
    return errorResponse(
      `V8 connect failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Evaluate JavaScript in the Electron main process via V8 Inspector.
 */
export async function v8Evaluate(args: {
  expression: string;
  connection_id?: string;
}): Promise<ToolResult> {
  try {
    const result = await v8Inspector.evaluate(args.expression, args.connection_id);
    return successResponse(result);
  } catch (error) {
    return errorResponse(
      `V8 evaluate failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Disconnect a V8 Inspector connection.
 */
export function v8Disconnect(args: {
  connection_id: string;
}): ToolResult {
  const result = v8Inspector.disconnect(args.connection_id);
  return successResponse(result);
}

/**
 * List all V8 Inspector connections.
 */
export function v8ListConnections(): ToolResult {
  const connections = v8Inspector.listConnections();

  if (connections.length === 0) {
    return successResponse('No V8 Inspector connections');
  }

  const lines = connections.map((c) => {
    const marker = c.active ? '>>>' : '   ';
    const status = c.connected ? 'connected' : 'disconnected';
    return `${marker} ${c.id} (port: ${c.port}, ${status})`;
  });

  return successResponse(`V8 Inspector Connections:\n${lines.join('\n')}`);
}
