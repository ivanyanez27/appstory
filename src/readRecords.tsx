import type { ReadRecord } from "./AppStoryTools";

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} kB`;
}

function formatTime(time: string): string {
  const parsed = new Date(time);
  return Number.isNaN(parsed.getTime()) ? time : parsed.toLocaleString();
}

/** One row for every source range an agent read, with the fields PRD §8 requires. */
export function ReadRecordList({ records }: { records: readonly ReadRecord[] }) {
  if (records.length === 0) {
    return <p className="lsw-reads-empty">No source has been read yet.</p>;
  }
  return (
    <ul className="lsw-reads-list">
      {[...records].reverse().map((record) => (
        <li key={record.id}>
          <code>{record.path}</code>
          <span className="lsw-reads-range">
            lines {record.startLine}–{record.endLine} of {record.totalLines} · {formatSize(record.size)}
          </span>
          <span className="lsw-reads-reason">{record.reason}</span>
          <span className="lsw-reads-time">{formatTime(record.time)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The header control for the read log. This is the app's audit trail, so it
 * stays one click from any screen rather than at the foot of the outline.
 */
export function SourceReadsButton({
  records,
  open,
  onToggle,
}: {
  records: readonly ReadRecord[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="lsw-help">
      <button type="button" className="lsw-help-btn" aria-expanded={open} onClick={onToggle}>
        Source reads · {records.length}
      </button>
      {open && (
        <div className="lsw-help-pop" role="group" aria-label="Source reads">
          <p className="lsw-help-label">Source reads</p>
          <p>
            Every range a WebMCP agent read from this repository. A read needs
            your consent, an approved indexed file, a stated reason, and no more
            than 500 lines. Source text is never saved to this browser or to any
            export.
          </p>
          <ReadRecordList records={records} />
        </div>
      )}
    </div>
  );
}
