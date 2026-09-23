/**
 * A minimal geometric mark: a bounded segment with a marker at the
 * estimate (M) and a wall at the boundary (U) — the whole protocol in
 * one shape, in the same spirit as ytechnology.eu's circle-built Y.
 */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="5" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="16" r="3.25" fill="currentColor" />
      <line x1="27" y1="9" x2="27" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
