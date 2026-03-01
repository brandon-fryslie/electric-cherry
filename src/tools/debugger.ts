/**
 * JavaScript Debugger Tools
 * Ported from Python debugger_* tools
 *
 * Uses Chrome DevTools Protocol (CDP) Debugger domain for:
 * - Setting breakpoints
 * - Stepping through code
 * - Inspecting call stack
 * - Evaluating expressions in paused context
 */

import { browserManager } from '../browser.js';
import { CDP_TIMEOUT } from '../config.js';
import { successResponse, errorResponse } from '../response.js';

/**
 * Helper to get CDP session with nice error message.
 */
async function getCdpSession(connectionId?: string, requireDebugger = true) {
  const connection = browserManager.getConnection(connectionId);
  if (!connection) {
    const id = connectionId || 'active';
    throw new Error(
      `No Chrome connection '${id}' found. Use chrome(action="connect", ...) or chrome(action="launch", ...) first.`
    );
  }

  if (requireDebugger && !connection.debuggerEnabled) {
    throw new Error(
      'Debugger not enabled. Call debugger_enable() first.'
    );
  }

  return connection.cdpSession;
}

/**
 * Enable the JavaScript debugger.
 *
 * This must be called before any other debugger operations.
 * Enables debugging features like breakpoints, pausing, and stepping.
 */
export async function debuggerEnable(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    await browserManager.enableDebugger(args.connection_id);

    return successResponse(
      `Debugger enabled successfully

You can now:
- Set breakpoints with debugger_set_breakpoint()
- Pause execution with debugger_pause()
- Configure exception breaking with debugger_set_pause_on_exceptions()`
    );
  } catch (error) {
    return errorResponse(`Error enabling debugger: ${error}`);
  }
}

/**
 * Set a breakpoint at a specific line in a source file.
 *
 * The debugger must be enabled first (call debugger_enable()).
 *
 * When code execution reaches this breakpoint, it will pause, allowing you to:
 * - Inspect the call stack (debugger_get_call_stack)
 * - Evaluate expressions in the current scope (debugger_evaluate_on_call_frame)
 * - Step through code (debugger_step_over, debugger_step_into, debugger_step_out)
 */
export async function debuggerSetBreakpoint(args: {
  url: string;
  line_number: number;
  column_number?: number;
  condition?: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { url, line_number, condition, connection_id } = args;
  const column_number = args.column_number ?? 0;

  try {
    const cdpSession = await getCdpSession(connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    // CDP uses 0-indexed line numbers
    const cdpParams = {
      url,
      lineNumber: line_number - 1,
      columnNumber: column_number,
      ...(condition ? { condition } : {}),
    };

    const result = await cdpSession.send(
      'Debugger.setBreakpointByUrl',
      cdpParams
    );

    const breakpointId = result.breakpointId as string;
    const locations = (result.locations as Array<{
      lineNumber: number;
      columnNumber: number;
    }>) || [];

    // Store breakpoint info
    browserManager.storeBreakpoint(connection_id, breakpointId, {
      url,
      lineNumber: line_number,
      columnNumber: column_number,
      condition,
    });

    let response = `Breakpoint set successfully

Breakpoint ID: ${breakpointId}
URL: ${url}
Line: ${line_number}`;

    if (condition) {
      response += `\nCondition: ${condition}`;
    }

    if (locations.length > 0) {
      const loc = locations[0];
      const actualLine = loc.lineNumber + 1; // Convert back to 1-indexed
      response += `\n\nActual location: Line ${actualLine}, Column ${loc.columnNumber}`;
    }

    response += '\n\nTrigger the code path to pause at this breakpoint.';

    return successResponse(response);
  } catch (error) {
    return errorResponse(`Error setting breakpoint: ${error}`);
  }
}

/**
 * Get the current call stack when execution is paused.
 *
 * This only works when execution is paused at a breakpoint or after debugger_pause().
 */
export async function debuggerGetCallStack(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    await getCdpSession(args.connection_id);

    const pausedData = browserManager.getPausedData(args.connection_id);
    if (!pausedData) {
      return successResponse(
        'Not paused. Set a breakpoint with debugger_set_breakpoint() and trigger it, or use debugger_pause() to pause execution.'
      );
    }

    const callFrames = pausedData.callFrames || [];
    const reason = pausedData.reason || 'unknown';

    if (callFrames.length === 0) {
      return successResponse('Execution is paused but no call stack available.');
    }

    const lines: string[] = [
      `Execution paused: ${reason}`,
      '',
      'Call Stack:',
      '='.repeat(60),
      '',
    ];

    for (let i = 0; i < callFrames.length; i++) {
      const frame = callFrames[i];
      const funcName = frame.functionName || '(anonymous)';
      const location = frame.location;
      const url = frame.url || 'unknown';
      const lineNum = location.lineNumber + 1; // Convert to 1-indexed
      const colNum = location.columnNumber || 0;

      lines.push(`[${i}] ${funcName}`);
      lines.push(`    Frame ID: ${frame.callFrameId}`);
      lines.push(`    Location: ${url}:${lineNum}:${colNum}`);

      // Show scope chain
      const scopeChain = frame.scopeChain || [];
      if (scopeChain.length > 0) {
        const scopes = scopeChain.map((s) => s.type);
        lines.push(`    Scopes: ${scopes.join(', ')}`);
      }

      lines.push('');
    }

    lines.push(
      'Use debugger_evaluate_on_call_frame(call_frame_id, expression) to inspect variables.'
    );
    lines.push(
      'Use debugger_step_over/into/out() to continue stepping, or debugger_resume() to continue execution.'
    );

    return successResponse(lines.join('\n'));
  } catch (error) {
    return errorResponse(`Error getting call stack: ${error}`);
  }
}

/**
 * Evaluate a JavaScript expression in the context of a specific call frame.
 *
 * This only works when execution is paused. Use debugger_get_call_stack() to get call frame IDs.
 */
export async function debuggerEvaluateOnCallFrame(args: {
  call_frame_id: string;
  expression: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { call_frame_id, expression, connection_id } = args;

  try {
    const cdpSession = await getCdpSession(connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    if (!browserManager.isPaused(connection_id)) {
      return successResponse(
        'Not paused. Cannot evaluate expressions outside of paused context.'
      );
    }

    const result = await cdpSession.send('Debugger.evaluateOnCallFrame', {
      callFrameId: call_frame_id,
      expression,
    });

    if (result.exceptionDetails) {
      const exception = result.exceptionDetails as { text?: string };
      const errorText = exception.text || 'Unknown error';
      return errorResponse(
        `Evaluation error: ${errorText}\n\nExpression: ${expression}`
      );
    }

    const resultObj = result.result as {
      type: string;
      value?: unknown;
      description?: string;
    };
    const resultType = resultObj.type || 'undefined';
    const resultValue = resultObj.value;
    const resultDescription = resultObj.description;

    let response = `Evaluated: ${expression}\n\nType: ${resultType}\n`;

    if (resultValue !== undefined) {
      response += `Value: ${JSON.stringify(resultValue, null, 2)}`;
    } else if (resultDescription) {
      response += `Description: ${resultDescription}`;
    } else {
      response += `Result: ${resultType}`;
    }

    return successResponse(response);
  } catch (error) {
    return errorResponse(`Error evaluating expression: ${error}`);
  }
}

/**
 * Step over the current line (execute current line and pause at next line).
 *
 * Only works when execution is paused at a breakpoint.
 */
export async function debuggerStepOver(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cdpSession = await getCdpSession(args.connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    if (!browserManager.isPaused(args.connection_id)) {
      return successResponse('Not paused. Cannot step when execution is not paused.');
    }

    await cdpSession.send('Debugger.stepOver');
    return successResponse(
      'Stepped over. Execution will pause at next line.\nUse debugger_get_call_stack() to see current location.'
    );
  } catch (error) {
    return errorResponse(`Error stepping over: ${error}`);
  }
}

/**
 * Step into the current function call.
 *
 * Only works when execution is paused at a breakpoint on a function call.
 */
export async function debuggerStepInto(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cdpSession = await getCdpSession(args.connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    if (!browserManager.isPaused(args.connection_id)) {
      return successResponse('Not paused. Cannot step when execution is not paused.');
    }

    await cdpSession.send('Debugger.stepInto');
    return successResponse(
      'Stepped into function. Execution will pause at first line.\nUse debugger_get_call_stack() to see current location.'
    );
  } catch (error) {
    return errorResponse(`Error stepping into: ${error}`);
  }
}

/**
 * Step out of the current function (continue until function returns).
 *
 * Only works when execution is paused at a breakpoint inside a function.
 */
export async function debuggerStepOut(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cdpSession = await getCdpSession(args.connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    if (!browserManager.isPaused(args.connection_id)) {
      return successResponse('Not paused. Cannot step when execution is not paused.');
    }

    await cdpSession.send('Debugger.stepOut');
    return successResponse(
      'Stepped out of function. Execution will pause at caller.\nUse debugger_get_call_stack() to see current location.'
    );
  } catch (error) {
    return errorResponse(`Error stepping out: ${error}`);
  }
}

/**
 * Resume execution after being paused at a breakpoint.
 *
 * Execution will continue until:
 * - Another breakpoint is hit
 * - An exception is thrown (if pause on exceptions is enabled)
 * - debugger_pause() is called
 */
export async function debuggerResume(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cdpSession = await getCdpSession(args.connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    if (!browserManager.isPaused(args.connection_id)) {
      return successResponse('Not paused. Nothing to resume.');
    }

    await cdpSession.send('Debugger.resume');
    return successResponse(
      'Execution resumed. Will pause at next breakpoint or exception.'
    );
  } catch (error) {
    return errorResponse(`Error resuming: ${error}`);
  }
}

/**
 * Pause JavaScript execution as soon as possible.
 *
 * After pausing, use debugger_get_call_stack() to see where execution stopped.
 */
export async function debuggerPause(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cdpSession = await getCdpSession(args.connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    await cdpSession.send('Debugger.pause');
    return successResponse(
      'Pause requested. Execution will pause at next statement.\nUse debugger_get_call_stack() once paused.'
    );
  } catch (error) {
    return errorResponse(`Error pausing: ${error}`);
  }
}

/**
 * Remove a previously set breakpoint.
 */
export async function debuggerRemoveBreakpoint(args: {
  breakpoint_id: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { breakpoint_id, connection_id } = args;

  try {
    const cdpSession = await getCdpSession(connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    await cdpSession.send('Debugger.removeBreakpoint', {
      breakpointId: breakpoint_id,
    });

    // Remove from tracking
    browserManager.removeBreakpoint(connection_id, breakpoint_id);

    return successResponse(`Breakpoint ${breakpoint_id} removed successfully`);
  } catch (error) {
    return errorResponse(`Error removing breakpoint: ${error}`);
  }
}

/**
 * Configure whether to pause when exceptions are thrown.
 */
export async function debuggerSetPauseOnExceptions(args: {
  state: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { state, connection_id } = args;

  // CDP uses 'caught' not 'all' for catching all exceptions
  const validStates = ['none', 'uncaught', 'all'];
  if (!validStates.includes(state)) {
    return errorResponse(
      `Error: state must be 'none', 'uncaught', or 'all' (got '${state}')`
    );
  }

  try {
    const cdpSession = await getCdpSession(connection_id);
    if (!cdpSession) {
      throw new Error('Debugger not enabled. Call debugger_enable() first.');
    }

    // CDP uses 'caught' for all exceptions, 'none' for none, 'uncaught' for uncaught
    const cdpState = state === 'all' ? 'caught' : state;
    await cdpSession.send('Debugger.setPauseOnExceptions', {
      state: cdpState as 'none' | 'uncaught' | 'caught',
    });

    const messages: Record<string, string> = {
      none: 'Will not pause on exceptions',
      uncaught: 'Will pause only on uncaught exceptions',
      all: 'Will pause on all exceptions (caught and uncaught)',
    };

    return successResponse(
      `Exception breaking configured\n\n${messages[state]}`
    );
  } catch (error) {
    return errorResponse(`Error setting pause on exceptions: ${error}`);
  }
}

/**
 * CONSOLIDATED: step - Step through code
 *
 * Replaces debugger_step_over, debugger_step_into, debugger_step_out.
 */
export async function step(args: {
  direction: 'over' | 'into' | 'out';
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.direction === 'over') {
    return debuggerStepOver({ connection_id: args.connection_id });
  } else if (args.direction === 'into') {
    return debuggerStepInto({ connection_id: args.connection_id });
  } else if (args.direction === 'out') {
    return debuggerStepOut({ connection_id: args.connection_id });
  } else {
    return errorResponse(`Invalid direction: ${args.direction}. Must be 'over', 'into', or 'out'.`);
  }
}

/**
 * CONSOLIDATED: execution - Control execution (resume or pause)
 *
 * Replaces debugger_resume and debugger_pause.
 */
export async function execution(args: {
  action: 'resume' | 'pause';
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.action === 'resume') {
    return debuggerResume({ connection_id: args.connection_id });
  } else if (args.action === 'pause') {
    return debuggerPause({ connection_id: args.connection_id });
  } else {
    return errorResponse(`Invalid action: ${args.action}. Must be 'resume' or 'pause'.`);
  }
}

/**
 * CONSOLIDATED: breakpoint - Set or remove breakpoints
 *
 * Replaces debugger_set_breakpoint and debugger_remove_breakpoint.
 */
export async function breakpoint(args: {
  action: 'set' | 'remove';
  url?: string;
  line_number?: number;
  column_number?: number;
  condition?: string;
  breakpoint_id?: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.action === 'set') {
    if (!args.url || args.line_number === undefined) {
      return errorResponse('Setting breakpoint requires url and line_number parameters.');
    }
    return debuggerSetBreakpoint({
      url: args.url,
      line_number: args.line_number,
      column_number: args.column_number,
      condition: args.condition,
      connection_id: args.connection_id,
    });
  } else if (args.action === 'remove') {
    if (!args.breakpoint_id) {
      return errorResponse('Removing breakpoint requires breakpoint_id parameter.');
    }
    return debuggerRemoveBreakpoint({
      breakpoint_id: args.breakpoint_id,
      connection_id: args.connection_id,
    });
  } else {
    return errorResponse(`Invalid action: ${args.action}. Must be 'set' or 'remove'.`);
  }
}

/**
 * Renamed from debugger_get_call_stack for consistency
 */
export async function callStack(args: {
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  return debuggerGetCallStack(args);
}

/**
 * Renamed from debugger_evaluate_on_call_frame for consistency
 */
export async function evaluate(args: {
  call_frame_id: string;
  expression: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  return debuggerEvaluateOnCallFrame(args);
}

/**
 * Renamed from debugger_set_pause_on_exceptions for consistency
 */
export async function pauseOnExceptions(args: {
  state: string;
  connection_id?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  return debuggerSetPauseOnExceptions(args);
}
