import React from 'react';

/**
 * Stroke icons for the command pad. Deliberately not emoji: emoji render at the
 * mercy of the host font, land at different optical weights per OS, and can't
 * take `currentColor`, so they always read as placeholder art.
 */

const PATHS: Record<string, React.ReactNode> = {
  spark:     <><path d="M12 3v18M3 12h18" /><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" opacity=".45" /></>,
  branch:    <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M6 8.4V14a4 4 0 0 0 4 4h5.6" /></>,
  plus:      <path d="M12 5v14M5 12h14" />,
  open:      <><path d="M5 12h13" /><path d="M13 7l5 5-5 5" /></>,
  duplicate: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 5H6a2 2 0 0 0-2 2v9" /></>,
  publish:   <><path d="M12 19V6" /><path d="M6 12l6-6 6 6" /></>,
  trash:     <><path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" /></>,
  check:     <path d="M5 12.5l4.5 4.5L19 7" />,
  back:      <><path d="M19 12H6" /><path d="M11 7l-5 5 5 5" /></>,
  library:   <><rect x="4" y="4" width="5" height="16" rx="1" /><rect x="11" y="4" width="4" height="16" rx="1" /><path d="M17.5 5l3 14" /></>,
  ingest:    <><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  flask:     <><path d="M10 3v6.5L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M9 3h6" /><path d="M7.5 14h9" /></>,
  bottle:    <><path d="M10 3h4v3.5l2 3V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9.5l2-3z" /><path d="M8 13h8" /></>,
  citrus:    <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17" opacity=".5" /></>,
  cube:      <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" opacity=".5" /></>,
  drop:      <path d="M12 3.5s5.5 6.3 5.5 10a5.5 5.5 0 0 1-11 0c0-3.7 5.5-10 5.5-10z" />,
  jar:       <><rect x="6" y="8" width="12" height="13" rx="2" /><path d="M8.5 8V5.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V8" /></>,
  glass:     <><path d="M5 4h14l-7 8z" /><path d="M12 12v7M8 21h8" /></>,
  circle:    <circle cx="12" cy="12" r="7.5" />,
};

export default function PadIcon({ name, size = 17 }: { name: string; size?: number }) {
  const path = PATHS[name] ?? PATHS.circle;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
