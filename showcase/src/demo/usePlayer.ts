import { useCallback, useEffect, useReducer, useRef } from 'react';
import { SCENARIOS } from './data/scenarios.ts';
import { getToolDetails, type ToolDetails } from './data/tool-details.ts';
import type {
  AppEffect,
  Bubble,
  CalloutInstance,
  ConnectionFlash,
  ConnectionId,
  MainState,
  RendererState,
  Scenario,
  WireRow,
} from './types.ts';

const TIMINGS = {
  userTypingCps: 24,
  assistantCps: 58,
  perCharJitter: 0.4,
  preToolCallHold: 900,
  toolHighlightHold: 1100,
  perWireOut: 260,
  perWireIn: 260,
  postWireHold: 500,
  postEffectHold: 1300,
  preConclusionHold: 600,
  postConclusionHold: 1200,
  interStep: 1200,
  calloutLifeMs: 3500,
  preFirstStepHold: 1100,
  beforeUserSubmit: 600,
  afterUserSubmit: 900,
  initialAutoplayHold: 1500,
};

interface State {
  scenarioIdx: number;
  stepIdx: number;
  playing: boolean;
  speed: number;
  bubbles: Bubble[];
  wireRows: WireRow[];
  callouts: CalloutInstance[];
  flashes: ConnectionFlash[];
  highlightedTool: string | null;
  selectedTool: ToolDetails | null;
  status: string;
  textareaValue: string;
  textareaDisabled: boolean;
  textareaPlaceholder: string;
  rendererState: RendererState;
  mainState: MainState;
  nextId: number;
  scenarioComplete: boolean;
}

type Action =
  | { type: 'reset-scenario'; scenarioIdx: number }
  | { type: 'set-scenario'; scenarioIdx: number }
  | { type: 'set-step'; stepIdx: number }
  | { type: 'set-playing'; playing: boolean }
  | { type: 'set-speed'; speed: number }
  | { type: 'set-status'; status: string }
  | { type: 'set-textarea'; value?: string; disabled?: boolean }
  | { type: 'add-bubble'; bubble: Omit<Bubble, 'id'> }
  | { type: 'update-bubble-text'; id: number; text: string }
  | { type: 'set-bubble-cursor'; id: number; cursor: boolean }
  | { type: 'remove-empty-placeholder' }
  | { type: 'add-wire'; row: Omit<WireRow, 'id'> }
  | { type: 'clear-wire' }
  | { type: 'add-callout'; callout: Omit<CalloutInstance, 'id'> }
  | { type: 'remove-callout'; id: number }
  | { type: 'add-flash'; flash: Omit<ConnectionFlash, 'id'> }
  | { type: 'remove-flash'; id: number }
  | { type: 'select-tool'; tool: ToolDetails | null }
  | { type: 'highlight-tool'; tool: string | null }
  | { type: 'apply-effect'; effect: AppEffect }
  | { type: 'set-renderer'; patch: Partial<RendererState> }
  | { type: 'set-main'; patch: Partial<MainState> }
  | { type: 'scenario-complete'; complete: boolean };

const INITIAL_RENDERER: RendererState = {
  cdpAttached: false,
  debuggerEnabled: false,
  paused: null,
  breakpoints: [],
  cart: { items: [{ sku: 'A1', qty: 2 }], total: 19.98 },
  consoleLines: [{ kind: 'log', text: '[renderer] page loaded' }],
  flashScreenshot: false,
  highlightedSelector: null,
  clickedSelector: null,
};

const INITIAL_MAIN: MainState = {
  v8Attached: false,
  process: {
    pid: 12345,
    cwd: '/Users/demo/myshop',
    versions: { electron: '34.2.0', chrome: '128.0.6613.36', node: '20.18.1', v8: '12.8.374.13' },
    memory: { heapUsed: 86, rss: 142 },
    ipcChannels: 4,
  },
  consoleLines: [{ text: '[main] app started, BrowserWindow created' }],
};

function makeInitialState(scenarioIdx: number): State {
  return {
    scenarioIdx,
    stepIdx: 0,
    playing: false,
    speed: 1,
    bubbles: [],
    wireRows: [],
    callouts: [],
    flashes: [],
    highlightedTool: null,
    selectedTool: null,
    status: 'Press play to watch the user prompt the agent, or type your own request.',
    textareaValue: '',
    textareaDisabled: true,
    textareaPlaceholder: 'Type a debugging request…',
    rendererState: INITIAL_RENDERER,
    mainState: INITIAL_MAIN,
    nextId: 1,
    scenarioComplete: false,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset-scenario':
      return makeInitialState(action.scenarioIdx);
    case 'set-scenario':
      return { ...state, scenarioIdx: action.scenarioIdx };
    case 'set-step':
      return { ...state, stepIdx: action.stepIdx };
    case 'set-playing':
      return { ...state, playing: action.playing };
    case 'set-speed':
      return { ...state, speed: action.speed };
    case 'set-status':
      return { ...state, status: action.status };
    case 'set-textarea':
      return {
        ...state,
        textareaValue: action.value ?? state.textareaValue,
        textareaDisabled: action.disabled ?? state.textareaDisabled,
      };
    case 'add-bubble': {
      const id = state.nextId;
      return {
        ...state,
        bubbles: [...state.bubbles, { id, ...action.bubble }],
        nextId: id + 1,
      };
    }
    case 'update-bubble-text':
      return {
        ...state,
        bubbles: state.bubbles.map((b) =>
          b.id === action.id ? { ...b, text: action.text } : b,
        ),
      };
    case 'set-bubble-cursor':
      return {
        ...state,
        bubbles: state.bubbles.map((b) =>
          b.id === action.id ? { ...b, cursor: action.cursor } : b,
        ),
      };
    case 'remove-empty-placeholder':
      // No-op — empty state is rendered conditionally when bubbles.length === 0.
      return state;
    case 'add-wire': {
      const id = state.nextId;
      const next = [{ id, ...action.row }, ...state.wireRows].slice(0, 80);
      return { ...state, wireRows: next, nextId: id + 1 };
    }
    case 'clear-wire':
      return { ...state, wireRows: [] };
    case 'add-callout': {
      const id = state.nextId;
      return {
        ...state,
        callouts: [...state.callouts, { id, ...action.callout }],
        nextId: id + 1,
      };
    }
    case 'remove-callout':
      return {
        ...state,
        callouts: state.callouts.filter((c) => c.id !== action.id),
      };
    case 'add-flash': {
      const id = state.nextId;
      return {
        ...state,
        flashes: [...state.flashes, { id, ...action.flash }],
        nextId: id + 1,
      };
    }
    case 'remove-flash':
      return {
        ...state,
        flashes: state.flashes.filter((f) => f.id !== action.id),
      };
    case 'select-tool':
      return { ...state, selectedTool: action.tool };
    case 'highlight-tool':
      return { ...state, highlightedTool: action.tool };
    case 'apply-effect':
      return applyEffect(state, action.effect);
    case 'set-renderer':
      return { ...state, rendererState: { ...state.rendererState, ...action.patch } };
    case 'set-main':
      return { ...state, mainState: { ...state.mainState, ...action.patch } };
    case 'scenario-complete':
      return { ...state, scenarioComplete: action.complete };
  }
}

function applyEffect(state: State, effect: AppEffect): State {
  const r = state.rendererState;
  const m = state.mainState;
  switch (effect.kind) {
    case 'highlight-elements':
      return { ...state, rendererState: { ...r, highlightedSelector: effect.selector } };
    case 'click': {
      const next: State = {
        ...state,
        rendererState: {
          ...r,
          clickedSelector: effect.selector,
          consoleLines:
            effect.sideEffect === 'console-error'
              ? [
                  ...r.consoleLines,
                  { kind: 'error', text: 'Uncaught TypeError: cart.checkout is not a function' },
                  { kind: 'error', text: '  at HTMLButtonElement.onclick (file:///Users/demo/myshop/app.js:42:14)' },
                ]
              : r.consoleLines,
        },
      };
      return next;
    }
    case 'pull-logs':
      return {
        ...state,
        rendererState: {
          ...r,
          consoleLines: [...r.consoleLines, { kind: 'meta', text: '[CDP captured 2 console events; returned to MCP]' }],
        },
      };
    case 'debugger-enabled':
      return {
        ...state,
        rendererState: {
          ...r,
          debuggerEnabled: true,
          consoleLines: [...r.consoleLines, { kind: 'meta', text: '[Debugger.enable / Runtime.enable acknowledged]' }],
        },
      };
    case 'breakpoint-set':
      return {
        ...state,
        rendererState: {
          ...r,
          breakpoints: [...r.breakpoints, { file: effect.file, line: effect.line }],
        },
      };
    case 'click-then-pause':
      // Click visual is set immediately; pause overlay is set by the orchestrator
      // a beat later via 'set-renderer' so the timing is right.
      return {
        ...state,
        rendererState: { ...r, clickedSelector: effect.selector },
      };
    case 'evaluate-popup':
      return {
        ...state,
        rendererState: {
          ...r,
          consoleLines: [
            ...r.consoleLines,
            { kind: 'eval', text: `> ${effect.expression}` },
            { kind: 'eval', text: `  ${JSON.stringify(effect.value)}` },
          ],
        },
      };
    case 'connect-both':
      return {
        ...state,
        rendererState: {
          ...r,
          cdpAttached: true,
          consoleLines: [...r.consoleLines, { kind: 'meta', text: '[CDP attached to renderer]' }],
        },
        mainState: {
          ...m,
          v8Attached: true,
          consoleLines: [...m.consoleLines, { text: '[V8 Inspector attached on :9229]' }],
        },
      };
    case 'main-log':
      return {
        ...state,
        mainState: { ...m, consoleLines: [...m.consoleLines, { text: effect.text }] },
      };
    case 'screenshot-flash':
      return { ...state, rendererState: { ...r, flashScreenshot: true } };
    case 'composed-report':
      return {
        ...state,
        mainState: { ...m, consoleLines: [...m.consoleLines, { text: '[composed report sent back to MCP client]' }] },
      };
    case 'resume-then-pause-again':
      // Initial: clear the paused state. Orchestrator will set it again after a beat.
      return { ...state, rendererState: { ...r, paused: null } };
  }
}

class Aborted extends Error {
  constructor() { super('aborted'); this.name = 'Aborted'; }
}

interface AbortToken { aborted: boolean }

function delay(ms: number, token: AbortToken): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token.aborted) { reject(new Aborted()); return; }
    const id = window.setTimeout(() => {
      if (token.aborted) reject(new Aborted());
      else resolve();
    }, ms);
    // Best-effort: if token aborts before timer fires, the timer still runs
    // and reject at fire-time — orchestrator will catch and stop. Simpler than
    // hooking up an AbortController for this scale.
    void id;
  });
}

export function usePlayer() {
  const [state, dispatch] = useReducer(reducer, 0, makeInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const tokenRef = useRef<AbortToken>({ aborted: false });
  const playingRef = useRef(false);
  const autoplayedRef = useRef(false);

  const t = (ms: number) => ms / stateRef.current.speed;

  const abortCurrent = useCallback(() => {
    tokenRef.current.aborted = true;
    tokenRef.current = { aborted: false };
    return tokenRef.current;
  }, []);

  // ---- text streaming primitives ------------------------------------------
  async function streamBubbleText(id: number, text: string, cps: number, token: AbortToken) {
    dispatch({ type: 'set-bubble-cursor', id, cursor: true });
    const charDelay = 1000 / cps;
    for (let i = 0; i < text.length; i++) {
      dispatch({ type: 'update-bubble-text', id, text: text.slice(0, i + 1) });
      await delay((charDelay + Math.random() * charDelay * TIMINGS.perCharJitter) / stateRef.current.speed, token);
    }
    dispatch({ type: 'set-bubble-cursor', id, cursor: false });
  }

  async function streamTextarea(text: string, cps: number, token: AbortToken) {
    dispatch({ type: 'set-textarea', disabled: false });
    const charDelay = 1000 / cps;
    for (let i = 0; i < text.length; i++) {
      dispatch({ type: 'set-textarea', value: text.slice(0, i + 1) });
      await delay((charDelay + Math.random() * charDelay * TIMINGS.perCharJitter) / stateRef.current.speed, token);
    }
  }

  function pushBubble(kind: Bubble['kind'], text = ''): number {
    const id = stateRef.current.nextId;
    dispatch({ type: 'add-bubble', bubble: { kind, text } });
    return id;
  }

  function pushToolCallBubble(tool: string, args: Record<string, unknown>): number {
    const id = stateRef.current.nextId;
    dispatch({ type: 'add-bubble', bubble: { kind: 'assistant-toolcall', text: '', toolCall: { tool, args } } });
    return id;
  }

  // [LAW:dataflow-not-control-flow] One emit shape — the call site picks
  // a connection and a protocol; the layer renders the flash. The layer
  // owns the topology; the orchestrator owns the timing.
  function emitFlash(connection: ConnectionId, protocol: ConnectionFlash['protocol']) {
    dispatch({ type: 'add-flash', flash: { connection, protocol } });
  }


  // ---- the play loop -------------------------------------------------------
  async function playIntro(scenario: Scenario, token: AbortToken) {
    dispatch({ type: 'set-status', status: 'User is typing their request…' });
    await streamTextarea(scenario.userPrompt, TIMINGS.userTypingCps, token);

    await delay(t(TIMINGS.beforeUserSubmit), token);
    dispatch({ type: 'set-status', status: 'User submits the request.' });
    pushBubble('user', scenario.userPrompt);
    dispatch({ type: 'set-textarea', value: '', disabled: true });

    await delay(t(TIMINGS.afterUserSubmit), token);
    dispatch({ type: 'set-status', status: 'Assistant is responding…' });

    const openingId = pushBubble('assistant', '');
    await streamBubbleText(openingId, scenario.assistantOpening, TIMINGS.assistantCps, token);
    await delay(t(TIMINGS.preFirstStepHold), token);
  }

  async function playStep(scenario: Scenario, stepIdx: number, token: AbortToken) {
    const step = scenario.steps[stepIdx];
    dispatch({ type: 'set-status', status: step.narration });

    const narrId = pushBubble('assistant', '');
    await streamBubbleText(narrId, step.narration, TIMINGS.assistantCps, token);

    if (step.reasoning) {
      const reasonId = pushBubble('assistant-reasoning', '');
      await streamBubbleText(reasonId, step.reasoning, TIMINGS.assistantCps, token);
      await delay(t(TIMINGS.preToolCallHold), token);
    }

    pushToolCallBubble(step.tool, step.args);
    dispatch({ type: 'highlight-tool', tool: step.tool });
    // Hop 1: agent → cherry (MCP request leaving the agent).
    emitFlash('agent-cherry', 'mcp');
    const protoNote =
      step.cdp.length && step.v8.length ? 'CDP + V8 Inspector'
      : step.cdp.length ? 'CDP'
      : step.v8.length ? 'V8 Inspector'
      : 'no protocol';
    dispatch({ type: 'set-status', status: `Calling ${step.tool} — electric-cherry routes this to ${protoNote}.` });
    await delay(t(TIMINGS.toolHighlightHold), token);

    for (const msg of step.cdp) {
      // Each wire round-trip flashes the cherry → renderer arrow on the
      // CDP branch. Overlapping flashes layer so the arrow reads as
      // "sustained traffic" while messages are in flight.
      emitFlash('cherry-cdp', 'cdp');
      dispatch({ type: 'add-wire', row: { direction: 'out', protocol: 'cdp', label: msg.method, payload: msg.params } });
      await delay(t(TIMINGS.perWireOut), token);
      emitFlash('cherry-cdp', 'cdp');
      dispatch({ type: 'add-wire', row: { direction: 'in', protocol: 'cdp', label: `${msg.method} (response)`, payload: { ok: true } } });
      await delay(t(TIMINGS.perWireIn), token);
    }
    for (const msg of step.v8) {
      emitFlash('cherry-v8', 'v8');
      dispatch({ type: 'add-wire', row: { direction: 'out', protocol: 'v8', label: msg.method, payload: msg.params } });
      await delay(t(TIMINGS.perWireOut), token);
      emitFlash('cherry-v8', 'v8');
      dispatch({ type: 'add-wire', row: { direction: 'in', protocol: 'v8', label: `${msg.method} (response)`, payload: { ok: true } } });
      await delay(t(TIMINGS.perWireIn), token);
    }
    // Hop 4: cherry → agent (MCP response returning the tool result).
    emitFlash('agent-cherry', 'mcp');
    await delay(t(TIMINGS.postWireHold), token);

    if (step.appEffect) {
      dispatch({ type: 'apply-effect', effect: step.appEffect });

      // Two-phase effects whose visible state lands a beat later.
      if (step.appEffect.kind === 'click-then-pause') {
        const eff = step.appEffect;
        await delay(350 / stateRef.current.speed, token);
        dispatch({ type: 'set-renderer', patch: { paused: { file: eff.file, line: eff.line } } });
      } else if (step.appEffect.kind === 'resume-then-pause-again') {
        const eff = step.appEffect;
        await delay(600 / stateRef.current.speed, token);
        const updatedLines = [
          ...stateRef.current.rendererState.consoleLines,
          { kind: 'meta' as const, text: '[paused AGAIN — duplicate listener detected]' },
        ];
        dispatch({
          type: 'set-renderer',
          patch: { paused: { file: eff.file, line: eff.line }, consoleLines: updatedLines },
        });
      } else if (step.appEffect.kind === 'highlight-elements') {
        await delay(1500 / stateRef.current.speed, token);
        dispatch({ type: 'set-renderer', patch: { highlightedSelector: null } });
      } else if (step.appEffect.kind === 'click') {
        await delay(350 / stateRef.current.speed, token);
        dispatch({ type: 'set-renderer', patch: { clickedSelector: null } });
      } else if (step.appEffect.kind === 'screenshot-flash') {
        await delay(240 / stateRef.current.speed, token);
        dispatch({ type: 'set-renderer', patch: { flashScreenshot: false } });
      }
    }

    if (step.callout) {
      const calloutId = stateRef.current.nextId;
      dispatch({
        type: 'add-callout',
        callout: { target: step.callout.target, text: step.callout.text, side: step.callout.side },
      });
      window.setTimeout(() => {
        dispatch({ type: 'remove-callout', id: calloutId });
      }, TIMINGS.calloutLifeMs / stateRef.current.speed);
    }

    dispatch({ type: 'set-status', status: 'Application is responding to the tool call.' });
    await delay(t(TIMINGS.postEffectHold), token);

    if (step.conclusion) {
      await delay(t(TIMINGS.preConclusionHold), token);
      const conclId = pushBubble('assistant-observation', '');
      await streamBubbleText(conclId, step.conclusion, TIMINGS.assistantCps, token);
      await delay(t(TIMINGS.postConclusionHold), token);
    }

    dispatch({ type: 'highlight-tool', tool: null });
  }

  async function runScenario(token: AbortToken) {
    const scenario = SCENARIOS[stateRef.current.scenarioIdx];
    try {
      await playIntro(scenario, token);
      for (let i = stateRef.current.stepIdx; i < scenario.steps.length; i++) {
        if (token.aborted || !playingRef.current) return;
        await playStep(scenario, i, token);
        dispatch({ type: 'set-step', stepIdx: i + 1 });
        if (i + 1 < scenario.steps.length) {
          await delay(t(TIMINGS.interStep), token);
        }
      }
      dispatch({ type: 'scenario-complete', complete: true });
      dispatch({ type: 'set-status', status: 'Scenario complete.' });
    } catch (err) {
      if (!(err instanceof Aborted)) throw err;
    } finally {
      playingRef.current = false;
      dispatch({ type: 'set-playing', playing: false });
    }
  }

  // ---- public API ----------------------------------------------------------
  const loadScenario = useCallback((idx: number) => {
    const token = abortCurrent();
    playingRef.current = false;
    dispatch({ type: 'reset-scenario', scenarioIdx: idx });
    void token;
  }, [abortCurrent]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    if (stateRef.current.scenarioComplete) {
      dispatch({ type: 'reset-scenario', scenarioIdx: stateRef.current.scenarioIdx });
    }
    playingRef.current = true;
    dispatch({ type: 'set-playing', playing: true });
    const token = abortCurrent();
    void runScenario(token);
  }, [abortCurrent]);

  const pause = useCallback(() => {
    playingRef.current = false;
    abortCurrent();
    dispatch({ type: 'set-playing', playing: false });
  }, [abortCurrent]);

  const setSpeed = useCallback((speed: number) => {
    dispatch({ type: 'set-speed', speed });
  }, []);

  const submitCustom = useCallback((text: string) => {
    if (!text.trim()) return;
    abortCurrent();
    playingRef.current = false;
    dispatch({ type: 'set-playing', playing: false });
    pushBubble('user', text);
    dispatch({ type: 'set-textarea', value: '' });
    pushBubble('assistant', "(this is a scripted demo — try the scenarios in the picker for full playback). Your prompt is logged as a user bubble; no real tools were called.");
    dispatch({ type: 'set-status', status: 'Custom prompt logged. Use the scenario picker to watch a full agent walkthrough.' });
  }, [abortCurrent]);

  const setTextareaValue = useCallback((value: string) => {
    dispatch({ type: 'set-textarea', value });
  }, []);

  // Click a tool chip → open the inspector with that tool's reference
  // entry. Doesn't disrupt the running scenario — the inspector is a modal
  // overlaid on the stage, the script keeps running underneath.
  const selectTool = useCallback((toolName: string) => {
    dispatch({ type: 'select-tool', tool: getToolDetails(toolName) });
  }, []);

  const closeInspector = useCallback(() => {
    dispatch({ type: 'select-tool', tool: null });
  }, []);

  const removeFlash = useCallback((id: number) => {
    dispatch({ type: 'remove-flash', id });
  }, []);

  const submitFromTextarea = useCallback(() => {
    const text = stateRef.current.textareaValue.trim();
    if (!text) return;
    abortCurrent();
    playingRef.current = false;
    dispatch({ type: 'set-playing', playing: false });
    pushBubble('user', text);
    dispatch({ type: 'set-textarea', value: '' });
    pushBubble('assistant', "(this is a scripted demo — try the scenarios in the picker for full playback). Your prompt is logged as a user bubble; no real tools were called.");
    dispatch({ type: 'set-status', status: 'Custom prompt logged. Use the scenario picker to watch a full agent walkthrough.' });
  }, [abortCurrent]);

  // ---- autoplay on mount ---------------------------------------------------
  // Start the timer in the body (not the cleanup-eligible position) and only
  // mark the autoplay flag inside the timer callback — that way StrictMode's
  // double-mount cycle in dev doesn't wedge the timer.
  useEffect(() => {
    if (autoplayedRef.current) return;
    const id = window.setTimeout(() => {
      autoplayedRef.current = true;
      play();
    }, TIMINGS.initialAutoplayHold);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    actions: {
      loadScenario,
      play,
      pause,
      setSpeed,
      submitCustom,
      setTextareaValue,
      submitFromTextarea,
      selectTool,
      closeInspector,
      removeFlash,
    },
    scenarios: SCENARIOS,
    stepCount: SCENARIOS[state.scenarioIdx].steps.length,
  };
}
