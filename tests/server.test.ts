import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Electric Cherry MCP Server', () => {
  it('should pass basic sanity check', () => {
    assert.ok(true, 'Basic test passes');
  });

  it('should have correct config values', async () => {
    const config = await import('../src/config.js');

    assert.strictEqual(config.MAX_RESULT_SIZE, 5000);
    assert.strictEqual(config.MAX_DOM_DEPTH, 3);
    assert.strictEqual(config.HARD_MAX_DOM_DEPTH, 10);
    assert.strictEqual(config.DEFAULT_CDP_PORT, 9222);
    assert.strictEqual(config.DEFAULT_V8_INSPECT_PORT, 9229);
    assert.strictEqual(config.V8_CONNECT_TIMEOUT, 5000);
    assert.strictEqual(config.V8_REQUEST_TIMEOUT, 10_000);
    assert.strictEqual(config.MAX_NETWORK_REQUESTS, 500);
  });

  it('should have response utilities including imageResponse', async () => {
    const { checkResultSize, escapeForJs, successResponse, errorResponse, imageResponse } =
      await import('../src/response.js');

    // escapeForJs
    assert.strictEqual(escapeForJs("test'string"), "test\\'string");
    assert.strictEqual(escapeForJs("line\nbreak"), 'line\\nbreak');

    // checkResultSize — small passes through
    assert.strictEqual(checkResultSize('Hello'), 'Hello');

    // checkResultSize — large is rejected
    const large = 'x'.repeat(6000);
    assert.ok(checkResultSize(large).includes('Result too large'));

    // successResponse
    const success = successResponse('ok');
    assert.deepStrictEqual(success, { content: [{ type: 'text', text: 'ok' }] });

    // errorResponse
    const error = errorResponse('fail');
    assert.deepStrictEqual(error, { content: [{ type: 'text', text: 'fail' }], isError: true });

    // imageResponse
    const img = imageResponse('base64data', 'image/png');
    assert.deepStrictEqual(img, {
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    });
  });

  it('should have browser manager with network support', async () => {
    const { browserManager } = await import('../src/browser.js');

    assert.ok(browserManager, 'BrowserManager should be exported');
    assert.strictEqual(browserManager.hasConnections(), false);
    assert.strictEqual(browserManager.getActiveId(), null);

    // Network requests start empty
    assert.deepStrictEqual(browserManager.getNetworkRequests(), []);
  });

  it('should have V8 Inspector client', async () => {
    const { v8Inspector } = await import('../src/v8-inspector.js');

    assert.ok(v8Inspector, 'v8Inspector should be exported');
    assert.deepStrictEqual(v8Inspector.listConnections(), []);
  });

  it('should find electron_setup for missing app', async () => {
    const { electronSetup } = await import('../src/tools/electron.js');

    const result = await electronSetup({ app_name: 'NonExistentApp99999' });
    assert.ok(result.isError, 'Should return error for missing app');
    const text = (result.content[0] as { type: 'text'; text: string }).text;
    assert.ok(text.includes('App not found'), `Expected "App not found" in: ${text}`);
  });

  it('should export all tool functions', async () => {
    const tools = await import('../src/tools/index.js');

    // Chrome
    assert.ok(typeof tools.chrome === 'function');
    assert.ok(typeof tools.chromeListConnections === 'function');
    assert.ok(typeof tools.chromeSwitchConnection === 'function');
    assert.ok(typeof tools.chromeDisconnect === 'function');
    assert.ok(typeof tools.target === 'function');
    assert.ok(typeof tools.enableDebugTools === 'function');
    assert.ok(typeof tools.hideTools === 'function');
    assert.ok(typeof tools.showTools === 'function');

    // DOM
    assert.ok(typeof tools.queryElements === 'function');
    assert.ok(typeof tools.clickElement === 'function');
    assert.ok(typeof tools.fillElement === 'function');
    assert.ok(typeof tools.navigate === 'function');
    assert.ok(typeof tools.getConsoleLogs === 'function');

    // Debugger
    assert.ok(typeof tools.step === 'function');
    assert.ok(typeof tools.execution === 'function');
    assert.ok(typeof tools.breakpoint === 'function');
    assert.ok(typeof tools.callStack === 'function');
    assert.ok(typeof tools.evaluate === 'function');
    assert.ok(typeof tools.pauseOnExceptions === 'function');

    // Electron
    assert.ok(typeof tools.electronSetup === 'function');
    assert.ok(typeof tools.electronConnect === 'function');

    // Renderer
    assert.ok(typeof tools.takeScreenshot === 'function');
    assert.ok(typeof tools.rendererEvaluate === 'function');

    // V8
    assert.ok(typeof tools.v8Connect === 'function');
    assert.ok(typeof tools.v8Evaluate === 'function');
    assert.ok(typeof tools.v8Disconnect === 'function');
    assert.ok(typeof tools.v8ListConnections === 'function');

    // Network
    assert.ok(typeof tools.enableNetwork === 'function');
    assert.ok(typeof tools.getNetworkRequests === 'function');
    assert.ok(typeof tools.clearNetworkRequests === 'function');
  });
});
