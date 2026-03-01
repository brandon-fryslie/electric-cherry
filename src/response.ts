/**
 * Response formatting utilities for Electric Cherry MCP
 * Ported from Python check_result_size and analyze_query_elements_data
 *
 * Key principle: REJECT oversized results with smart analysis
 * instead of truncating (which wastes tokens on incomplete data).
 */

import { MAX_RESULT_SIZE } from './config.js';
import type { QueryElementsResult } from './types.js';

/**
 * Analyze query_elements data and provide specific narrowing suggestions.
 * This is deterministic - we control the JSON format.
 *
 * @param data - Parsed query_elements result
 * @returns Suggestions string
 */
export function analyzeQueryElementsData(data: QueryElementsResult): string {
  const elements = data.elements || [];
  if (elements.length === 0) {
    return 'No elements found';
  }

  // Collect class, id, and tag data
  const classes: string[] = [];
  const ids: string[] = [];
  const tags: string[] = [];

  for (const el of elements) {
    if (el.classes && el.classes.length > 0) {
      classes.push(...el.classes);
    }
    if (el.id) {
      ids.push(el.id);
    }
    if (el.tag) {
      tags.push(el.tag);
    }
  }

  const suggestions: string[] = [];
  const total = elements.length;
  suggestions.push(`Found ${total} elements. Here's how to narrow it down:`);

  // Suggest specific classes (most common)
  if (classes.length > 0) {
    const classCounts = new Map<string, number>();
    for (const c of classes) {
      classCounts.set(c, (classCounts.get(c) || 0) + 1);
    }

    const topClasses = [...classCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const classSuggestions = topClasses.map(
      ([c, count]) => `.${c} (${count} elements)`
    );
    suggestions.push(`  Most common classes: ${classSuggestions.join(', ')}`);
  }

  // Suggest specific IDs
  if (ids.length > 0) {
    const idSuggestions = ids.slice(0, 5).map((id) => `#${id}`);
    suggestions.push(`  IDs available: ${idSuggestions.join(', ')}`);
  }

  // Suggest tag narrowing
  if (tags.length > 0) {
    const tagCounts = new Map<string, number>();
    for (const t of tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }

    if (tagCounts.size > 1) {
      const tagList = [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, c]) => `${t} (${c})`);
      suggestions.push(`  Tag breakdown: ${tagList.join(', ')}`);
    }
  }

  // Add actionable suggestions
  const topClass =
    classes.length > 0
      ? [...new Map(classes.map((c) => [c, 1])).keys()][0]
      : 'classname';
  suggestions.push(
    `\nTry: Combine selector with a class (e.g., 'yourselector.${topClass}')`
  );
  suggestions.push(
    `Or: Reduce limit parameter (currently showing ${total} elements)`
  );

  return suggestions.join('\n');
}

/**
 * Generic suggestions for different tool contexts.
 */
const GENERIC_SUGGESTIONS: Record<string, string> = {
  console_logs: `Too many console messages.

Try filtering by level:
  - get_console_logs(filter_level='error') - Only errors
  - get_console_logs(filter_level='warning') - Warnings and errors
  - get_console_logs(filter_level='info') - Info, warnings, and errors`,

  network_requests: `Too many network requests.

Try filtering by status:
  - get_network_requests(filter_status='4xx') - Client errors (404, etc.)
  - get_network_requests(filter_status='5xx') - Server errors
  - get_network_requests(filter_status='2xx') - Successful requests
  - get_network_requests(filter_status='3xx') - Redirects`,

  execute_script: `Script returned too much data.

Try limiting the result in JavaScript:
  - Use .slice(0, 10) to get first 10 items
  - Use .filter() to get only specific items
  - Return summary data instead of full objects
  - Select only needed fields: .map(x => ({id: x.id, name: x.name}))`,

  default: 'Try to be more specific in your query or filter the results',
};

/**
 * Check if result is too large and return helpful error if so.
 *
 * Instead of truncating (which wastes tokens on useless partial data),
 * reject oversized results with a smart error message that analyzes the data
 * and provides specific suggestions for narrowing the query.
 *
 * @param result - The result string to check
 * @param maxSize - Maximum allowed size in characters
 * @param context - Tool context for suggestions
 * @param analysisData - Optional structured data for deterministic analysis
 * @returns Original result if small enough, or error message with suggestions
 */
export function checkResultSize(
  result: string,
  maxSize: number = MAX_RESULT_SIZE,
  context?: string,
  analysisData?: QueryElementsResult
): string {
  if (result.length <= maxSize) {
    return result;
  }

  // Result is too large - provide smart suggestions
  const sizeKb = result.length / 1024;
  const limitKb = maxSize / 1024;

  // Perform deterministic analysis if we have structured data
  let smartAnalysis: string;

  if (context === 'query_elements' && analysisData) {
    smartAnalysis = analyzeQueryElementsData(analysisData);
  } else {
    smartAnalysis =
      GENERIC_SUGGESTIONS[context || 'default'] ||
      GENERIC_SUGGESTIONS['default'];
  }

  return `Result too large: ${sizeKb.toFixed(1)}KB (limit: ${limitKb.toFixed(1)}KB)

Returning ${result.length.toLocaleString()} characters would waste tokens on potentially incomplete data.

${smartAnalysis}

Size: ${result.length.toLocaleString()} chars (max: ${maxSize.toLocaleString()})`;
}

/**
 * Format a successful tool response.
 *
 * @param text - Response text
 * @returns Tool result object
 */
export function successResponse(text: string): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Format an error tool response.
 *
 * @param text - Error text
 * @returns Tool result object with isError flag
 */
export function errorResponse(text: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

/**
 * Format an image tool response.
 *
 * @param base64Data - Base64-encoded image data
 * @param mimeType - Image MIME type (e.g., 'image/png')
 * @returns Tool result object with image content
 */
export function imageResponse(base64Data: string, mimeType: string): {
  content: Array<{ type: 'image'; data: string; mimeType: string }>;
} {
  return {
    content: [{ type: 'image', data: base64Data, mimeType }],
  };
}

/**
 * Escape single quotes in a string for JavaScript strings.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeForJs(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
