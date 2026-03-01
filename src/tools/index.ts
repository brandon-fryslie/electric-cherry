/**
 * Tool exports — unified tool set (no legacy/smart split)
 */

// Chrome connection tools (consolidated)
export {
  chrome,
  chromeListConnections,
  chromeSwitchConnection,
  chromeDisconnect,
  target,
  enableDebugTools,
  hideTools,
  showTools,
} from './chrome.js';

// DOM interaction tools
export {
  queryElements,
  clickElement,
  fillElement,
  navigate,
  getConsoleLogs,
} from './dom.js';

// Debugger tools (consolidated)
export {
  step,
  execution,
  breakpoint,
  callStack,
  evaluate,
  pauseOnExceptions,
} from './debugger.js';

// Electron app discovery and connection
export {
  electronSetup,
  electronConnect,
} from './electron.js';

// Renderer tools (screenshot, eval)
export {
  takeScreenshot,
  rendererEvaluate,
} from './renderer.js';

// V8 Inspector tools (main process)
export {
  v8Connect,
  v8Evaluate,
  v8Disconnect,
  v8ListConnections,
} from './v8.js';

// Network monitoring tools
export {
  enableNetwork,
  getNetworkRequests,
  clearNetworkRequests,
} from './network.js';
