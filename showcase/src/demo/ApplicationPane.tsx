import type { MainState, RendererState } from './types.ts';

interface Props {
  renderer: RendererState;
  main: MainState;
}

export function ApplicationPane({ renderer, main }: Props) {
  const { highlightedSelector, clickedSelector } = renderer;
  const isHl = (selectors: string) =>
    selectors.split(',').some((s) => s.trim() === highlightedSelector) ? 'ec-hl' : '';
  const isClicked = (sel: string) => clickedSelector === sel ? 'ec-clicked' : '';

  return (
    <section className="ec-actor ec-application application">
      <header className="ec-actor-head">
        <span className="ec-avatar ec-app-avatar">⚡</span>
        <span className="ec-actor-title">
          <span className="ec-actor-name">application (Electron)</span>
          <span className="ec-actor-sub">renderer + main · the thing being debugged</span>
        </span>
      </header>

      <div className="ec-app-halves">
        {/* RENDERER HALF */}
        <div
          className={[
            'ec-half', 'renderer-half',
            renderer.cdpAttached ? 'ec-cdp-attached' : '',
            renderer.paused ? 'ec-paused' : '',
            renderer.flashScreenshot ? 'ec-flash' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="ec-half-label">renderer · CDP</div>
          <div className="mr-body">
            <div className="mr-chrome">
              <span className="mr-tab">MyShop — checkout</span>
              <span className="mr-attach">{renderer.cdpAttached ? 'CDP attached' : 'not attached'}</span>
            </div>
            {renderer.paused ? (
              <div className="mr-paused-overlay">
                <span>⏸ Paused at {renderer.paused.file}:{renderer.paused.line}</span>
              </div>
            ) : null}
            <div className="mr-page">
              <h2>MyShop</h2>
              <div className="mr-item"><span>Widget A</span><span>$9.99</span></div>
              <div className="mr-item"><span>Widget B</span><span>$5.99</span></div>
              <div className="mr-buttons">
                <button className={['add-btn',      isHl('button')].filter(Boolean).join(' ')}>Add to cart</button>
                <button className={['checkout-btn', isHl('button,.checkout-btn'), isClicked('.checkout-btn')].filter(Boolean).join(' ')}>Checkout</button>
                <button className={['cancel-btn',   isHl('button')].filter(Boolean).join(' ')}>Cancel</button>
                <button id="submit-btn" className={['submit-btn', isHl('button,#submit-btn'), isClicked('#submit-btn')].filter(Boolean).join(' ')}>Submit</button>
              </div>
              <div className="mr-cart">
                Cart: {renderer.cart.items.reduce((s, i) => s + i.qty, 0)} item(s) · ${renderer.cart.total.toFixed(2)}
              </div>
            </div>
            {renderer.breakpoints.length > 0 ? (
              <div className="mr-breakpoints">
                {renderer.breakpoints.map((b) => (
                  <div key={`${b.file}:${b.line}`} className="bp-marker">● {b.file}:{b.line}</div>
                ))}
              </div>
            ) : null}
            <div className="mr-console">
              <div className="mr-console-head">renderer console</div>
              {renderer.consoleLines.map((l, i) => (
                <div key={i} className={`mr-line mr-line-${l.kind}`}>
                  <code>{l.text}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN HALF */}
        <div className={['ec-half', 'main-half', main.v8Attached ? 'ec-v8-attached' : ''].filter(Boolean).join(' ')}>
          <div className="ec-half-label">main · V8 Inspector</div>
          <div className="mm-body">
            <div className="mm-chrome">
              <span className="mm-label">main process (Node)</span>
              <span className="mm-attach">{main.v8Attached ? 'V8 Inspector attached' : 'not attached'}</span>
            </div>
            <div className="mm-stats">
              <div><span>pid</span><code>{main.process.pid}</code></div>
              <div><span>cwd</span><code>{main.process.cwd}</code></div>
              <div><span>electron</span><code>{main.process.versions.electron}</code></div>
              <div><span>node</span><code>{main.process.versions.node}</code></div>
              <div><span>heapUsed</span><code>{main.process.memory.heapUsed} MB</code></div>
              <div><span>rss</span><code>{main.process.memory.rss} MB</code></div>
              <div><span>ipcChannels</span><code>{main.process.ipcChannels}</code></div>
            </div>
            <div className="mm-console">
              <div className="mm-console-head">main process console</div>
              {main.consoleLines.map((l, i) => (
                <div key={i} className="mm-line"><code>{l.text}</code></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
