export function Legend() {
  return (
    <footer className="lsw-legend">
      <span>
        <i className="swatch character" /> Actor
      </span>
      <span>
        <i className="swatch place" /> Screen
      </span>
      <span>
        <i className="swatch plot" /> Decision or outcome
      </span>
      <span>
        <i className="swatch note" /> Gap or unknown path
      </span>
      <span>
        <i className="swatch region" /> Application area
      </span>
      <em>Ask your WebMCP agent to map the app.</em>
    </footer>
  );
}
