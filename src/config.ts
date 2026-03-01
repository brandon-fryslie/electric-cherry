/**
 * Configuration constants for Electric Cherry MCP
 * Ported from Python config.py
 */

/**
 * Maximum result size in characters.
 * Results larger than this will be REJECTED with a helpful error message
 * (not truncated - that would waste tokens on incomplete data).
 * 5000 chars approximately equals 1250 tokens.
 */
export const MAX_RESULT_SIZE = 5000;

/**
 * Maximum DOM depth for query_elements.
 * Elements nested deeper than this are filtered out to prevent returning
 * the entire page when querying broad selectors like "div".
 * Depth is measured from document.body.
 * Setting this low (3) forces agents to use specific selectors.
 * Agents can override with max_depth parameter up to HARD_MAX_DOM_DEPTH.
 */
export const MAX_DOM_DEPTH = 3;

/**
 * Hard limit for DOM depth.
 * Even if agent requests higher depth, this is the absolute maximum.
 * Prevents returning massive amounts of irrelevant data.
 */
export const HARD_MAX_DOM_DEPTH = 10;

/**
 * Enable debug logging to stderr.
 */
export const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * CDP command timeout in milliseconds.
 */
export const CDP_TIMEOUT = 10_000;

/**
 * Wait time after launching Chrome before connecting (ms).
 */
export const CHROME_LAUNCH_WAIT = 2000;

/**
 * Default port for Electron --remote-debugging-port (CDP).
 */
export const DEFAULT_CDP_PORT = 9222;

/**
 * Default port for Electron --inspect (V8 Inspector).
 */
export const DEFAULT_V8_INSPECT_PORT = 9229;

/**
 * V8 Inspector WebSocket connection timeout in milliseconds.
 */
export const V8_CONNECT_TIMEOUT = 5000;

/**
 * V8 Inspector request timeout in milliseconds.
 */
export const V8_REQUEST_TIMEOUT = 10_000;

/**
 * Maximum network requests to buffer per connection.
 * Oldest requests are dropped when this limit is reached.
 */
export const MAX_NETWORK_REQUESTS = 500;
