/**
 * DOM Interaction Tools
 * Ported from Python query_elements, click_element, fill_element, navigate, get_console_logs
 */

import { browserManager } from '../browser.js';
import { MAX_DOM_DEPTH, HARD_MAX_DOM_DEPTH } from '../config.js';
import {
  checkResultSize,
  successResponse,
  errorResponse,
  escapeForJs,
} from '../response.js';
import type { QueryElementsResult, DomActionResult } from '../types.js';

/**
 * Get page for a connection, with error handling.
 */
function getPage(connectionId?: string) {
  const connection = browserManager.getConnection(connectionId);
  if (!connection) {
    const id = connectionId || 'active';
    throw new Error(
      `No Chrome connection '${id}' found. Use chrome_connect() or chrome_launch() first.`
    );
  }
  return connection.page;
}

/**
 * Find elements by CSS selector and return their details.
 *
 * Automatically filters out deeply nested elements (depth > 3 from body) to prevent
 * returning the entire page when using broad selectors like "div" or "*".
 * This forces you to use specific selectors and keeps results compact.
 */
export async function queryElements(args: {
  selector: string;
  limit?: number;
  max_depth?: number;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const selector = args.selector;
  const limit = args.limit ?? 20;
  let maxDepth = args.max_depth ?? MAX_DOM_DEPTH;

  // Enforce hard limit
  if (maxDepth > HARD_MAX_DOM_DEPTH) {
    maxDepth = HARD_MAX_DOM_DEPTH;
  }

  try {
    const page = getPage(args.connection_id);
    const escapedSelector = escapeForJs(selector);

    // JavaScript to execute in page context (ported from Python)
    const script = `
      (() => {
        const maxDepth = ${maxDepth};

        // Calculate depth from body
        function getDepth(el) {
          let depth = 0;
          let current = el;
          while (current && current !== document.body) {
            depth++;
            current = current.parentElement;
          }
          return depth;
        }

        // Count total descendants
        function countDescendants(el) {
          let count = 0;
          function countRecursive(node) {
            for (const child of node.children) {
              count++;
              countRecursive(child);
            }
          }
          countRecursive(el);
          return count;
        }

        // Get all matching elements
        const allElements = Array.from(document.querySelectorAll('${escapedSelector}'));

        // Filter by depth
        const elementsWithDepth = allElements.map(el => ({
          element: el,
          depth: getDepth(el)
        }));

        const filteredElements = elementsWithDepth.filter(item => item.depth <= maxDepth);
        const filtered = allElements.length - filteredElements.length;

        // Apply limit and extract data
        const limit = ${limit};
        const limitedElements = filteredElements.slice(0, limit);

        return {
          found: allElements.length,
          foundAfterDepthFilter: filteredElements.length,
          filteredByDepth: filtered,
          maxDepth: maxDepth,
          elements: limitedElements.map((item, idx) => {
            const el = item.element;
            const rect = el.getBoundingClientRect();

            // If this element is at max depth, count its children
            let childInfo = null;
            if (item.depth === maxDepth && el.children.length > 0) {
              childInfo = {
                directChildren: el.children.length,
                totalDescendants: countDescendants(el)
              };
            }

            return {
              index: idx,
              selector: '${escapedSelector}',
              tag: el.tagName.toLowerCase(),
              text: el.textContent ? el.textContent.trim().substring(0, 100) : '',
              id: el.id || null,
              classes: el.className ? el.className.split(' ').filter(c => c) : [],
              visible: el.offsetParent !== null,
              depth: item.depth,
              childInfo: childInfo,
              position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              attributes: {
                type: el.type || null,
                name: el.name || null,
                placeholder: el.placeholder || null,
                value: el.value !== undefined ? String(el.value).substring(0, 100) : null
              }
            };
          })
        };
      })()
    `;

    const data = (await page.evaluate(script)) as QueryElementsResult;

    if (data.found === 0) {
      return successResponse(`No elements found matching selector: ${selector}`);
    }

    // Build output
    const output: string[] = [];

    const foundTotal = data.found;
    const foundFiltered = data.foundAfterDepthFilter;
    const filteredCount = data.filteredByDepth;
    const maxDepthUsed = data.maxDepth;

    if (filteredCount > 0) {
      output.push(`Found ${foundTotal} element(s) matching '${selector}'`);
      output.push(
        `Filtered out ${filteredCount} deeply nested element(s) (depth > ${maxDepthUsed})`
      );
      output.push(
        `Showing first ${Math.min(foundFiltered, limit)} of ${foundFiltered} remaining:`
      );
    } else {
      output.push(
        `Found ${foundTotal} element(s) matching '${selector}' (showing first ${Math.min(foundTotal, limit)}):`
      );
    }
    output.push('');

    for (const el of data.elements) {
      const depthInfo =
        el.depth !== undefined ? ` (depth: ${el.depth})` : '';
      output.push(`[${el.index}] <${el.tag}>${depthInfo}`);

      if (el.id) {
        output.push(`    ID: #${el.id}`);
      }
      if (el.classes && el.classes.length > 0) {
        output.push(`    Classes: ${el.classes.join(', ')}`);
      }
      if (el.text) {
        output.push(`    Text: ${el.text}`);
      }

      const attrs = el.attributes;
      const relevantAttrs: Record<string, string> = {};
      if (attrs.type) relevantAttrs['type'] = attrs.type;
      if (attrs.name) relevantAttrs['name'] = attrs.name;
      if (attrs.placeholder) relevantAttrs['placeholder'] = attrs.placeholder;
      if (attrs.value) relevantAttrs['value'] = attrs.value;

      if (Object.keys(relevantAttrs).length > 0) {
        output.push(`    Attributes: ${JSON.stringify(relevantAttrs)}`);
      }

      output.push(`    Visible: ${el.visible}`);

      // Show inline elision message if this element has children that were filtered
      if (el.childInfo) {
        const direct = el.childInfo.directChildren;
        const total = el.childInfo.totalDescendants;
        output.push(
          `    [ELIDED ${direct} DIRECT CHILD ELEMENT${direct !== 1 ? 'S' : ''} (${total} element${total !== 1 ? 's' : ''} total). INCREASE SELECTOR SPECIFICITY]`
        );
      }

      output.push('');
    }

    const result = output.join('\n');
    return successResponse(
      checkResultSize(result, undefined, 'query_elements', data)
    );
  } catch (error) {
    return errorResponse(`Error querying elements: ${error}`);
  }
}

/**
 * Click an element matching the CSS selector.
 *
 * Use query_elements first to verify the element exists and get the correct index.
 */
export async function clickElement(args: {
  selector: string;
  index?: number;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const selector = args.selector;
  const index = args.index ?? 0;

  try {
    const page = getPage(args.connection_id);
    const escapedSelector = escapeForJs(selector);

    // JavaScript click with fallback (ported from Python)
    const script = `
      (() => {
        const elements = document.querySelectorAll('${escapedSelector}');
        if (elements.length === 0) {
          return { success: false, error: 'No elements found matching selector' };
        }
        if (${index} >= elements.length) {
          return { success: false, error: 'Only ' + elements.length + ' element(s) found, index ${index} out of range' };
        }

        const element = elements[${index}];
        element.click();

        return {
          success: true,
          clicked: '<' + element.tagName.toLowerCase() + '> at index ${index}',
          text: element.textContent ? element.textContent.trim().substring(0, 50) : ''
        };
      })()
    `;

    const result = (await page.evaluate(script)) as DomActionResult;

    if (result.success) {
      return successResponse(`Clicked ${result.clicked}: ${result.text || ''}`);
    } else {
      return errorResponse(`Failed: ${result.error}`);
    }
  } catch (error) {
    return errorResponse(`Error clicking element: ${error}`);
  }
}

/**
 * Fill text into an input element matching the CSS selector.
 *
 * Use query_elements first to verify the input exists and get the correct index.
 */
export async function fillElement(args: {
  selector: string;
  text: string;
  index?: number;
  submit?: boolean;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const selector = args.selector;
  const text = args.text;
  const index = args.index ?? 0;
  const submit = args.submit ?? false;

  try {
    const page = getPage(args.connection_id);
    const escapedSelector = escapeForJs(selector);
    const escapedText = escapeForJs(text);

    // JavaScript fill with events (ported from Python)
    const script = `
      (() => {
        const elements = document.querySelectorAll('${escapedSelector}');
        if (elements.length === 0) {
          return { success: false, error: 'No elements found matching selector' };
        }
        if (${index} >= elements.length) {
          return { success: false, error: 'Only ' + elements.length + ' element(s) found, index ${index} out of range' };
        }

        const element = elements[${index}];

        // Set value
        element.value = '${escapedText}';

        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Submit if requested
        if (${submit}) {
          element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }

        return {
          success: true,
          filled: '<' + element.tagName.toLowerCase() + '> at index ${index}',
          type: element.type || 'text'
        };
      })()
    `;

    const result = (await page.evaluate(script)) as DomActionResult;

    if (result.success) {
      const submitMsg = submit ? ' and submitted' : '';
      return successResponse(
        `Filled ${result.filled} (${result.type})${submitMsg}`
      );
    } else {
      return errorResponse(`Failed: ${result.error}`);
    }
  } catch (error) {
    return errorResponse(`Error filling element: ${error}`);
  }
}

/**
 * Navigate to a URL.
 */
export async function navigate(args: {
  url: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const page = getPage(args.connection_id);
    await page.goto(args.url, { waitUntil: 'networkidle2' });
    return successResponse(`Navigated to ${args.url}`);
  } catch (error) {
    return errorResponse(`Error navigating: ${error}`);
  }
}

/**
 * Get console log messages from the browser.
 *
 * Console messages are captured automatically when connected.
 * Returns the most recent messages (default: 3).
 */
export async function getConsoleLogs(args: {
  filter_level?: string;
  limit?: number;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const filterLevel = args.filter_level ?? 'all';
  const limit = args.limit ?? 3;

  try {
    // Verify connection exists
    const connection = browserManager.getConnection(args.connection_id);
    if (!connection) {
      const id = args.connection_id || 'active';
      throw new Error(
        `No Chrome connection '${id}' found. Use chrome_connect() or chrome_launch() first.`
      );
    }

    // Get logs from browser manager
    const logs = browserManager.getConsoleLogs(args.connection_id, filterLevel);

    if (logs.length === 0) {
      return successResponse(
        `No console messages captured${filterLevel !== 'all' ? ` (filter: ${filterLevel})` : ''}.`
      );
    }

    // Get most recent logs up to limit
    const recentLogs = logs.slice(-limit);
    const totalCount = logs.length;

    const output: string[] = [];
    output.push(
      `Console messages (showing ${recentLogs.length} of ${totalCount}${filterLevel !== 'all' ? `, filter: ${filterLevel}` : ''}):`
    );
    output.push('');

    for (const log of recentLogs) {
      const timestamp = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12);
      const location = log.url ? ` (${log.url}${log.lineNumber ? `:${log.lineNumber}` : ''})` : '';
      output.push(`[${timestamp}] [${log.level.toUpperCase()}] ${log.text}${location}`);
    }

    return successResponse(output.join('\n'));
  } catch (error) {
    return errorResponse(`Error getting console logs: ${error}`);
  }
}
