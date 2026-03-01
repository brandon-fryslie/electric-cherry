/**
 * Network monitoring tools — capture and inspect HTTP requests.
 *
 * [LAW:one-way-deps] Depends on browser.ts, response.ts, config.ts only.
 */

import { browserManager } from '../browser.js';
import { successResponse, errorResponse } from '../response.js';
import { checkResultSize } from '../response.js';
import type { ToolResult, NetworkRequest } from '../types.js';

/**
 * Filter network requests by status code range.
 * Always runs — 'all' filter returns everything.
 * [LAW:dataflow-not-control-flow]
 */
function filterByStatus(requests: NetworkRequest[], filter: string): NetworkRequest[] {
  const ranges: Record<string, [number, number]> = {
    '2xx': [200, 300],
    '3xx': [300, 400],
    '4xx': [400, 500],
    '5xx': [500, 600],
  };

  const range = ranges[filter];
  // 'all' or unrecognized filter → return everything
  if (!range) return requests;

  return requests.filter((r) => r.status !== null && r.status >= range[0] && r.status < range[1]);
}

/**
 * Filter network requests by resource type.
 * Always runs — empty/undefined filter returns everything.
 * [LAW:dataflow-not-control-flow]
 */
function filterByType(requests: NetworkRequest[], resourceType: string | undefined): NetworkRequest[] {
  if (!resourceType) return requests;
  const lower = resourceType.toLowerCase();
  return requests.filter((r) => r.resourceType.toLowerCase() === lower);
}

/**
 * Format a network request for display.
 */
function formatRequest(req: NetworkRequest, index: number): string {
  const status = req.status !== null ? String(req.status) : 'pending';
  const size = req.encodedDataLength !== null ? `${(req.encodedDataLength / 1024).toFixed(1)}KB` : '?';
  return `[${index}] ${status} ${req.method} ${req.url} (${req.resourceType}, ${size})`;
}

/**
 * Enable network request monitoring.
 */
export async function enableNetwork(args: {
  connection_id?: string;
}): Promise<ToolResult> {
  try {
    const result = await browserManager.enableNetworkMonitoring(args.connection_id);
    return successResponse(result);
  } catch (error) {
    return errorResponse(
      `Enable network failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get captured network requests with optional filtering.
 */
export function getNetworkRequests(args: {
  filter_status?: string;
  resource_type?: string;
  limit?: number;
  connection_id?: string;
}): ToolResult {
  const allRequests = browserManager.getNetworkRequests(args.connection_id);

  // [LAW:dataflow-not-control-flow] Filters always run, varying by input values
  const byStatus = filterByStatus(allRequests, args.filter_status ?? 'all');
  const byType = filterByType(byStatus, args.resource_type);
  const limited = byType.slice(-(args.limit ?? 50));

  if (limited.length === 0) {
    const filterNote = args.filter_status && args.filter_status !== 'all'
      ? ` (filter: ${args.filter_status})`
      : '';
    return successResponse(`No network requests captured${filterNote}. Is network monitoring enabled?`);
  }

  const offset = byType.length - limited.length;
  const lines = limited.map((req, i) => formatRequest(req, offset + i));
  const header = `Network Requests (${limited.length} of ${allRequests.length} total):`;
  const result = `${header}\n${lines.join('\n')}`;

  const checked = checkResultSize(result, undefined, 'network_requests');
  return successResponse(checked);
}

/**
 * Clear captured network requests.
 */
export function clearNetworkRequests(args: {
  connection_id?: string;
}): ToolResult {
  browserManager.clearNetworkRequests(args.connection_id);
  return successResponse('Network requests cleared');
}
