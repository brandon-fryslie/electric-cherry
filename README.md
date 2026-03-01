# Electric Cherry MCP

Electron debugging MCP server for both processes:

- Renderer process via Chrome DevTools Protocol (CDP)
- Main process via V8 Inspector Protocol

## Features

- Electron app discovery + launch command generation (`electron_setup`)
- Dual connect to renderer + main process (`electron_connect`)
- Chrome/Electron connection management (`chrome`, `target`, connection switching)
- Renderer automation by CSS selector (`query_elements`, `click_element`, `fill_element`, `navigate`)
- JavaScript debugger controls (breakpoints, stepping, call stack, evaluation)
- Network capture and filtering
- Renderer screenshot + evaluation
- Main-process evaluation via V8 Inspector

## Requirements

- Node.js 20+
- macOS (for `electron_setup` app discovery in `/Applications`)

## Install

```bash
npm install
npm run build
```

## Run

```bash
node build/src/index.js
```

## Configure as MCP server

```json
{
  "mcpServers": {
    "electric-cherry": {
      "command": "node",
      "args": ["/absolute/path/to/electric-cherry/build/src/index.js"]
    }
  }
}
```

## Development

```bash
npm run dev
npm run build
npm test
```

## Tool Groups (30 total)

- Electron: `electron_setup`, `electron_connect`
- Chrome connection: `chrome`, `chrome_list_connections`, `chrome_switch_connection`, `chrome_disconnect`, `target`
- DOM: `query_elements`, `click_element`, `fill_element`, `navigate`, `get_console_logs`
- Renderer: `take_screenshot`, `renderer_evaluate`
- V8: `v8_connect`, `v8_evaluate`, `v8_disconnect`, `v8_list_connections`
- Network: `enable_network`, `get_network_requests`, `clear_network_requests`
- Debugger: `enable_debug_tools`, `breakpoint`, `step`, `execution`, `call_stack`, `evaluate`, `pause_on_exceptions`
- Tool visibility: `hide_tools`, `show_tools`
