/**
 * Renderer process tools — screenshot and arbitrary JS evaluation.
 *
 * [LAW:one-way-deps] Depends on browser.ts, response.ts only.
 */

import { browserManager } from '../browser.js';
import { successResponse, errorResponse, imageResponse } from '../response.js';
import type { ToolResult } from '../types.js';

/**
 * Capture a screenshot of the current page.
 */
export async function takeScreenshot(args: {
  format?: 'png' | 'jpeg';
  full_page?: boolean;
  connection_id?: string;
}): Promise<ToolResult> {
  const connection = browserManager.getConnection(args.connection_id);
  if (!connection) {
    return errorResponse('No Chrome connection found. Use chrome() or electron_connect() first.');
  }

  const format = args.format ?? 'png';
  const data = await connection.page.screenshot({
    type: format,
    fullPage: args.full_page ?? false,
    encoding: 'base64',
  }) as string;

  return imageResponse(data, `image/${format}`);
}

/**
 * Evaluate arbitrary JavaScript in the renderer process.
 * Unlike the debugger `evaluate` tool, this does not require a paused state.
 */
export async function rendererEvaluate(args: {
  expression: string;
  connection_id?: string;
}): Promise<ToolResult> {
  const connection = browserManager.getConnection(args.connection_id);
  if (!connection) {
    return errorResponse('No Chrome connection found. Use chrome() or electron_connect() first.');
  }

  try {
    // page.evaluate wraps the expression in a function — use page.evaluate
    // with a function that evals the string to support arbitrary expressions
    const result = await connection.page.evaluate((expr: string) => {
      // eslint-disable-next-line no-eval
      return eval(expr);
    }, args.expression);

    const formatted = result === undefined
      ? 'undefined'
      : JSON.stringify(result, null, 2);

    return successResponse(formatted);
  } catch (error) {
    return errorResponse(
      `Renderer evaluation error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
