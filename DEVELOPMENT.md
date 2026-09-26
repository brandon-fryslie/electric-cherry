# Development Guide

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Local Run

```bash
node build/src/index.js
```

## Watch Mode

```bash
pnpm dev
```

## MCP Inspector

```bash
pnpm dlx @modelcontextprotocol/inspector node build/src/index.js
```

## Structure

```text
src/
  index.ts          # MCP server entrypoint + tool routing
  browser.ts        # CDP connection manager
  v8-inspector.ts   # V8 Inspector client
  response.ts       # response formatting and size checks
  config.ts         # constants
  tools/            # tool handlers
tests/
```
