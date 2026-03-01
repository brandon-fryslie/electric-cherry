# CLAUDE.md

## Project

Electric Cherry is a TypeScript MCP server for Electron debugging:

- Renderer process tools via Chrome DevTools Protocol
- Main process tools via V8 Inspector

## Commands

```bash
npm run build
npm test
npm run dev
node build/src/index.js
```

## Notes

- Tool routing is centralized in `src/index.ts`.
- `BrowserManager` in `src/browser.ts` owns CDP connections, debugger state, console logs, and network capture.
- `V8InspectorClient` in `src/v8-inspector.ts` owns WebSocket RPC for main-process evaluation.
