interface Props { text: string }

export function StatusLine({ text }: Props) {
  return (
    <aside className="ec-status-line">
      <span className="ec-status-text">{text}</span>
    </aside>
  );
}
