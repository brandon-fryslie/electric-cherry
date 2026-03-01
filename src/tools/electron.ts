/**
 * Electron app discovery and connection tools.
 *
 * [LAW:one-way-deps] Depends on browser.ts, v8-inspector.ts, config.ts, response.ts.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { createServer } from 'net';

import { DEFAULT_CDP_PORT, DEFAULT_V8_INSPECT_PORT } from '../config.js';
import { browserManager } from '../browser.js';
import { v8Inspector } from '../v8-inspector.js';
import { successResponse, errorResponse } from '../response.js';
import type { ToolResult } from '../types.js';

/**
 * Find a free port, preferring the given port if available.
 */
function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => {
      // Preferred port is in use — find any free port
      const fallback = createServer();
      fallback.once('error', reject);
      fallback.listen(0, () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        fallback.close(() => resolve(port));
      });
    });
    server.listen(preferred, () => {
      server.close(() => resolve(preferred));
    });
  });
}

/**
 * Discover an Electron app in /Applications and generate a launch command
 * with debugging flags.
 */
export async function electronSetup(args: {
  app_name: string;
  cdp_port?: number;
  v8_port?: number;
}): Promise<ToolResult> {
  const { app_name: appName } = args;

  // Resolve app bundle path
  const appPath = `/Applications/${appName}.app`;
  if (!existsSync(appPath)) {
    return errorResponse(
      `App not found: ${appName}\n\n` +
      `Looked in: /Applications/${appName}.app\n\n` +
      `Tip: run 'ls /Applications/*.app' to see available apps.`
    );
  }

  // Get executable name from Info.plist
  const infoPath = `${appPath}/Contents/Info`;
  let executable: string;
  try {
    executable = execSync(`defaults read "${infoPath}" CFBundleExecutable`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    return errorResponse(
      `Could not read CFBundleExecutable from ${infoPath}.plist\n` +
      `The app may not have a standard macOS bundle structure.`
    );
  }

  const executablePath = `${appPath}/Contents/MacOS/${executable}`;
  if (!existsSync(executablePath)) {
    return errorResponse(`Executable not found at: ${executablePath}`);
  }

  // Find free ports
  const cdpPort = await findFreePort(args.cdp_port ?? DEFAULT_CDP_PORT);
  const v8Port = await findFreePort(args.v8_port ?? DEFAULT_V8_INSPECT_PORT);

  const launchCmd = `"${executablePath}" --remote-debugging-port=${cdpPort} --inspect=${v8Port}`;

  return successResponse(
    `Electron app: ${appName}\n` +
    `Executable: ${executablePath}\n\n` +
    `Launch command:\n\n  ${launchCmd}\n\n` +
    `After launching, connect with:\n  electron_connect(cdp_port=${cdpPort}, v8_port=${v8Port})\n\n` +
    `Ports:\n  CDP (renderer): ${cdpPort}\n  V8 Inspector (main): ${v8Port}`
  );
}

/**
 * Connect both CDP (renderer) and V8 Inspector (main process) to a running Electron app.
 */
export async function electronConnect(args: {
  cdp_port: number;
  v8_port: number;
  connection_id?: string;
}): Promise<ToolResult> {
  const connectionId = args.connection_id ?? 'electron';
  const results: string[] = [];
  let hasError = false;

  // Connect CDP (renderer)
  try {
    const cdpResult = await browserManager.connect(connectionId, 'localhost', args.cdp_port);
    results.push(`Renderer (CDP): ${cdpResult}`);
  } catch (error) {
    results.push(`Renderer (CDP): FAILED — ${error instanceof Error ? error.message : String(error)}`);
    hasError = true;
  }

  // Connect V8 Inspector (main process)
  try {
    const v8Result = await v8Inspector.connect(connectionId, args.v8_port);
    results.push(`Main process (V8): ${v8Result}`);
  } catch (error) {
    results.push(`Main process (V8): FAILED — ${error instanceof Error ? error.message : String(error)}`);
    hasError = true;
  }

  const summary = hasError
    ? `Partial connection (ID: ${connectionId})\n\n${results.join('\n')}`
    : `Connected to Electron app (ID: ${connectionId})\n\n${results.join('\n')}`;

  return hasError ? errorResponse(summary) : successResponse(summary);
}
