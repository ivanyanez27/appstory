import { useState } from "react";

export function CardFace(props: {
  kind: "character" | "place" | "plot" | "note" | "region";
  name: string;
  summary: string;
  imageUrl: string;
  editing: boolean;
  onName: (value: string) => void;
  onSummary: (value: string) => void;
  pulsing: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const label =
    props.kind === "character"
      ? "CHARACTER"
      : props.kind === "place"
        ? "PLACE"
        : props.kind === "plot"
          ? "PLOT"
          : props.kind === "note"
            ? "NOTE"
            : "REGION";

  return (
    <div className={`lsw-card lsw-card-${props.kind}${props.pulsing ? " pulse" : ""}`}>
      <div className="lsw-card-kicker">{label}</div>
      {props.editing ? (
        <input
          className="lsw-card-input"
          value={props.name}
          onChange={(e) => props.onName(e.target.value)}
        />
      ) : (
        <div className="lsw-card-name">{props.name || "Untitled"}</div>
      )}
      {props.kind !== "note" && props.kind !== "region" && (
        props.editing ? (
          <textarea
            className="lsw-card-input lsw-card-summary-input"
            value={props.summary}
            onChange={(e) => props.onSummary(e.target.value)}
          />
        ) : (
          props.summary && <div className="lsw-card-summary">{props.summary}</div>
        )
      )}
      {props.imageUrl && !broken && (
        <img
          className="lsw-card-image"
          src={props.imageUrl}
          alt=""
          onError={() => setBroken(true)}
        />
      )}
      {props.imageUrl && broken && (
        <div className="lsw-card-image-missing">image missing</div>
      )}
    </div>
  );
}
