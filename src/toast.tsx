type Props = { message: string | null };

export function AgentToast({ message }: Props) {
  if (!message) return null;
  // Status message per WCAG 4.1.3: an agent action (or a save failure) should
  // reach a screen reader user without moving focus, since nothing else in
  // the UI marks that the board just changed.
  return (
    <div className="lsw-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
