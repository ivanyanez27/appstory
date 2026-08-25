import { MAX_CARDS } from "./world";

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
      WebMCP unsupported — open in ChatGPT
    </span>
  );
}

export function CardCount({ cardCount }: { cardCount: number }) {
  return (
    <span className="lsw-count">
      {cardCount} / {MAX_CARDS}
    </span>
  );
}
