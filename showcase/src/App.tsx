import { Header, ScrollPin, MetadataFooter, CodeBlock } from 'showcase-kit';
import { DebugDemo } from './demo/DebugDemo.tsx';

export function App() {
  return (
    <>
      <Header
        eyebrow="an experiment by brandon-fryslie"
        name="electric-cherry"
        tagline={
          <>
            Electron debugging MCP server: one tool surface for both halves —
            renderer through Chrome DevTools Protocol, main process through V8
            Inspector. Watch an agent walk a real bug below.
          </>
        }
        badges={['MCP server', 'CDP + V8 Inspector', '30 tools', 'TypeScript']}
        actions={
          <>
            <a
              className="sk-meta-link sk-meta-link-primary"
              href="https://github.com/brandon-fryslie/electric-cherry"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
            <a
              className="sk-meta-link"
              href="https://github.com/brandon-fryslie/electric-cherry#readme"
              rel="noopener noreferrer"
            >
              README
            </a>
          </>
        }
      />

      <ScrollPin>
        <DebugDemo />
      </ScrollPin>

      <section className="ec-quickstart">
        <div className="ec-quickstart-inner">
          <h2>How it works</h2>
          <p>
            electric-cherry exposes one cohesive set of MCP tools that route to
            the right protocol under the hood. <code>query_elements</code> goes
            to the renderer over CDP. <code>v8_evaluate</code> goes to the main
            process over V8 Inspector. <code>electron_connect</code> attaches
            both halves under one connection id. Your agent stops caring which
            wire any given operation runs on.
          </p>
          <CodeBlock
            language="JSON"
            code={`{
  "mcpServers": {
    "electric-cherry": {
      "command": "npx",
      "args": ["electric-cherry"]
    }
  }
}`}
          />
        </div>
      </section>

      <MetadataFooter
        github="https://github.com/brandon-fryslie/electric-cherry"
        license="MIT"
        language="TypeScript"
        install="npm install electric-cherry"
        links={[
          { label: 'Tool source', href: 'https://github.com/brandon-fryslie/electric-cherry/tree/master/src/tools' },
          { label: 'DEVELOPMENT.md', href: 'https://github.com/brandon-fryslie/electric-cherry/blob/master/DEVELOPMENT.md' },
          { label: 'Model Context Protocol', href: 'https://modelcontextprotocol.io/' },
        ]}
      />
    </>
  );
}
