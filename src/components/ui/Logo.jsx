import { cx } from "./styles";

// The brand mark: a round hi-vis badge holding a map pin with a check, for "job done".
// Ink with a lime pin on light pages; on dark pages the two swap (--logo-badge and
// --logo-pin in index.css). public/icons/icon.svg is the same pin on a square tile.
export function LogoMark({ className = "h-9 w-9" }) {
  return (
    <svg viewBox="0 0 120 120" className={cx("block shrink-0", className)} aria-hidden="true">
      <circle cx="60" cy="60" r="58" className="fill-logo-badge" />
      <g transform="translate(29 22) scale(0.62)">
        <path
          d="M50 120 L15.99 65.05 A40 40 0 1 1 84.01 65.05 Z"
          className="fill-logo-pin stroke-logo-pin"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M30 45.2 L44.25 59.5 L71.3 29.6"
          className="stroke-logo-badge"
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// The name as the logo writes it: ink on a lime block, tilted like a strip of hi-vis tape.
// The same on light and dark pages. Sized by the font size around it.
export function Wordmark({ className }) {
  return (
    <span
      className={cx(
        "inline-block -rotate-2 rounded-[0.14em] bg-accent px-[0.3em] pb-[0.2em] pt-[0.13em] font-display font-extrabold leading-none tracking-[-0.03em] text-logo-ink",
        className,
      )}
    >
      Capleki
    </span>
  );
}
