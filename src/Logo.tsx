/* App Story identity. The mark is terminal code brackets around a central
   active trace node — "code compiling into human-readable visual stories".
   The wordmark sets "App" in text colour and "Story" in the amber accent,
   italic, per Brand Guidelines v1.0. */

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="App Story"
    >
      <rect
        x="1.6"
        y="1.6"
        width="28.8"
        height="28.8"
        rx="7"
        fill="none"
        stroke="var(--indigo)"
        strokeWidth="1.6"
      />
      <path
        d="M13 9 6.5 16 13 23"
        fill="none"
        stroke="var(--text)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 9 25.5 16 19 23"
        fill="none"
        stroke="var(--text)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3" fill="var(--teal)" />
    </svg>
  );
}

export function Logo({
  markSize = 26,
  className,
}: {
  markSize?: number;
  className?: string;
}) {
  const classes = className ? `brand-wordmark ${className}` : "brand-wordmark";
  return (
    <span className={classes}>
      <LogoMark size={markSize} />
      <span>
        App <span className="brand-wordmark-story">Story</span>
      </span>
    </span>
  );
}
