type Props = {
  supported: boolean;
  toolCount: number;
};

export function StatusChip({ supported, toolCount }: Props) {
  if (supported) {
    return (
      <span className="lsw-chip lsw-chip-ok">
        WebMCP ready · {toolCount} tools
      </span>
    );
  }
  return (
    <span className="lsw-chip lsw-chip-warn">
      WebMCP unavailable — use a WebMCP-enabled browser
    </span>
  );
}

export function CardCount({ cardCount }: { cardCount: number }) {
  return (
    <span className="lsw-count" aria-label={`${cardCount} graph items`}>
      {cardCount} items
    </span>
  );
}
