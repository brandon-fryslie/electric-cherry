import { useEffect, useRef, type FormEvent } from 'react';
import type { Bubble } from './types.ts';

interface ChatPanelProps {
  bubbles: Bubble[];
  textareaValue: string;
  textareaDisabled: boolean;
  textareaPlaceholder: string;
  onTextareaChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatPanel({
  bubbles,
  textareaValue,
  textareaDisabled,
  textareaPlaceholder,
  onTextareaChange,
  onSubmit,
}: ChatPanelProps) {
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the chat to the latest bubble as it appears or its text
  // streams in.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <section className="ec-actor ec-agent">
      <header className="ec-actor-head">
        <span className="ec-avatar ec-agent-avatar">A</span>
        <span className="ec-actor-title">
          <span className="ec-actor-name">agent</span>
          <span className="ec-actor-sub">MCP client</span>
        </span>
      </header>

      <div className="ec-chat" ref={chatRef}>
        {bubbles.length === 0 ? (
          <div className="ec-chat-empty">
            Empty conversation. Pick a scenario to watch the user prompt the agent,
            or type your own request below.
          </div>
        ) : (
          bubbles.map((b) => <BubbleView key={b.id} bubble={b} />)
        )}
      </div>

      <form className="ec-chat-input" onSubmit={handleSubmit}>
        <textarea
          rows={2}
          placeholder={textareaPlaceholder}
          value={textareaValue}
          disabled={textareaDisabled}
          onChange={(e) => onTextareaChange(e.target.value)}
        />
        <button type="submit" disabled={textareaDisabled || !textareaValue.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

function BubbleView({ bubble }: { bubble: Bubble }) {
  const cls = ['ec-bubble', `ec-bubble-${bubble.kind}`];
  if (bubble.cursor) cls.push('ec-bubble-cursor');
  if (bubble.toolCall) {
    return (
      <div className={cls.join(' ')}>
        <code className="ec-bubble-tname">{bubble.toolCall.tool}</code>
        <span className="ec-bubble-args"> ({JSON.stringify(bubble.toolCall.args)})</span>
      </div>
    );
  }
  return <div className={cls.join(' ')}>{bubble.text}</div>;
}
