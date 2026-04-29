export const TOOL_PALETTE = [
  { name: 'electron_setup',      group: 'electron' },
  { name: 'electron_connect',    group: 'electron' },
  { name: 'chrome',              group: 'connect' },
  { name: 'target',              group: 'connect' },
  { name: 'query_elements',      group: 'dom' },
  { name: 'click_element',       group: 'dom' },
  { name: 'fill_element',        group: 'dom' },
  { name: 'navigate',            group: 'dom' },
  { name: 'get_console_logs',    group: 'dom' },
  { name: 'take_screenshot',     group: 'renderer' },
  { name: 'renderer_evaluate',   group: 'renderer' },
  { name: 'enable_debug_tools',  group: 'debugger' },
  { name: 'breakpoint',          group: 'debugger' },
  { name: 'step',                group: 'debugger' },
  { name: 'execution',           group: 'debugger' },
  { name: 'call_stack',          group: 'debugger' },
  { name: 'evaluate',            group: 'debugger' },
  { name: 'pause_on_exceptions', group: 'debugger' },
  { name: 'enable_network',      group: 'network' },
  { name: 'get_network_requests',group: 'network' },
  { name: 'v8_connect',          group: 'v8' },
  { name: 'v8_evaluate',         group: 'v8' },
  { name: 'v8_disconnect',       group: 'v8' },
] as const;

export const GROUP_LABEL: Record<string, string> = {
  electron: 'Electron',
  connect:  'Connection',
  dom:      'DOM (CDP)',
  renderer: 'Renderer (CDP)',
  debugger: 'Debugger (CDP)',
  network:  'Network (CDP)',
  v8:       'Main / V8 Inspector',
};

export const GROUP_PROTOCOL: Record<string, 'cdp' | 'v8' | 'either'> = {
  electron: 'either',
  connect:  'cdp',
  dom:      'cdp',
  renderer: 'cdp',
  debugger: 'cdp',
  network:  'cdp',
  v8:       'v8',
};

export const GROUP_ORDER = ['electron', 'connect', 'dom', 'renderer', 'debugger', 'network', 'v8'] as const;
