// Z5 :: icon set — one consistent family of monochrome line icons.
// All icons inherit currentColor and scale with the `size` prop, so they
// tint with whatever text color surrounds them (no emoji, no colored
// glyphs). Directional icons (chevrons, arrows) take `flip` so they
// mirror automatically in RTL.
//
//   <Icon name="chevronForward" size={16} flip />

const PATHS = {
  // ── Navigation / tabs ──
  home: <>
    <path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
    <path d="M9.5 20.5v-6.2h5v6.2" />
  </>,
  calendar: <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </>,
  target: <>
    <circle cx="12" cy="12" r="7.25" />
    <path d="M12 2.5v4.25M12 17.25v4.25M2.5 12h4.25M17.25 12h4.25" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </>,
  book: <>
    <path d="M5 19.25A2.25 2.25 0 0 1 7.25 17H19.5" />
    <path d="M7.25 3H19.5v18H7.25A2.25 2.25 0 0 1 5 18.75V5.25A2.25 2.25 0 0 1 7.25 3z" />
  </>,
  chart: <>
    <path d="M3.5 20.5h17" />
    <path d="M4.5 16 10 10.5l4 4L20 8" />
    <path d="M15.5 8H20v4.5" />
  </>,
  people: <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
    <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.4a5 5 0 0 1 3 4.6v1" />
  </>,
  person: <>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20.5v-1a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v1" />
  </>,
  cycles: <>
    <path d="M20.5 5v5h-5" />
    <path d="M3.5 19v-5h5" />
    <path d="M5.2 9.5A7.5 7.5 0 0 1 18 6.9l2.5 3.1M3.5 14 6 17.1a7.5 7.5 0 0 0 12.8-2.6" />
  </>,
  personCheck: <>
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
    <path d="m16.5 10.5 2 2 3.5-3.75" />
  </>,

  // ── Chevrons / arrows (use with flip for RTL) ──
  chevronForward: <path d="m9 5 7 7-7 7" />,
  chevronBack: <path d="m15 5-7 7 7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  chevronUp: <path d="m5 15 7-7 7 7" />,
  chevronUpDown: <path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" />,
  arrowForward: <path d="M4 12h16M13.5 5.5 20 12l-6.5 6.5" />,
  arrowBack: <path d="M20 12H4M10.5 5.5 4 12l6.5 6.5" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  undo: <path d="M8.5 8 4.5 12l4 4M5 12h9a5.5 5.5 0 0 1 0 11h-2" transform="translate(0 -3.5)" />,

  // ── Actions ──
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  xmark: <path d="m6 6 12 12M18 6 6 18" />,
  pencil: <>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="m14.5 7.5 3 3" />
  </>,
  trash: <>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
    <path d="M10 11v5.5M14 11v5.5" />
  </>,
  ellipsis: <>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
  search: <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>,
  copy: <>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </>,
  link: <>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </>,
  upload: <>
    <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
  </>,
  download: <>
    <path d="M12 4v11.5M7.5 11 12 15.5 16.5 11" />
    <path d="M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
  </>,
  refresh: <>
    <path d="M20 5v5h-5" />
    <path d="M19.4 14a7.5 7.5 0 1 1-1.5-7.2L20 10" />
  </>,
  swap: <>
    <path d="M4 8h14.5M15 4.5 18.5 8 15 11.5" />
    <path d="M20 16H5.5M9 12.5 5.5 16 9 19.5" />
  </>,
  logout: <>
    <path d="M14 4.5h3.5A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2H14" />
    <path d="M4 12h10M10.5 8 14 12l-3.5 4" transform="translate(-0.5 0)" />
  </>,
  filter: <path d="M4 6.5h16M7 12h10M10 17.5h4" />,
  sort: <path d="M7 5v14M3.5 15.5 7 19l3.5-3.5M17 19V5M13.5 8.5 17 5l3.5 3.5" />,

  // ── Objects ──
  megaphone: <>
    <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l8.5 4V4.5L8 8.5H5.5A1.5 1.5 0 0 0 4 10z" />
    <path d="M19.5 9.5a3.5 3.5 0 0 1 0 5M8 15.5l1 4.5" />
  </>,
  clipboard: <>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
    <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 4.5z" />
    <path d="m9 13.5 2 2 4-4.25" />
  </>,
  doc: <>
    <path d="M6.5 3h7.5l4.5 4.5V19a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v4.5h4.5M8.5 13h7M8.5 16.5h5" />
  </>,
  folder: <path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.6l2.2 2.5H18A2.5 2.5 0 0 1 20.5 9.5v8A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z" />,
  image: <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="8.75" cy="9.75" r="1.6" />
    <path d="m4 17 4.8-4.4 3.4 3 3-2.6 5 4.3" />
  </>,
  camera: <>
    <path d="M4 8.5A2 2 0 0 1 6 6.5h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
  clock: <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
  pin: <>
    <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </>,
  lock: <>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </>,
  unlock: <>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
  </>,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />,
  flag: <path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12" />,
  gear: <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
  </>,
  sun: <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3" />
  </>,
  moon: <path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z" />,
  globe: <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5S9.6 6 12 3.5z" />
  </>,
  key: <>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 8.5-8.5M16 6.5l2.5 2.5M13.5 9l2 2" />
  </>,
  mail: <>
    <rect x="3.5" y="5.5" width="17" height="13.5" rx="2.5" />
    <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
  </>,
  rifle: <>
    <path d="M2.5 13.5h13l2-2h4v2.5h-3.5l-1.5 1.5H9l-1.5 3H5l1-3H2.5z" />
    <path d="M12 11.5V9.5h4.5" />
  </>,
  graduation: <>
    <path d="m12 4.5 9.5 4.5-9.5 4.5L2.5 9z" />
    <path d="M6.5 11v4.5c1.5 1.4 3.3 2 5.5 2s4-.600 5.5-2V11M21.5 9v5" />
  </>,

  // ── Status ──
  info: <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.75" r="1" fill="currentColor" stroke="none" />
  </>,
  warning: <>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </>,
  checkCircle: <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8 12.3 2.8 2.8L16 9.5" />
  </>,
  xCircle: <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </>,
  eye: <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
  list: <path d="M8.5 6.5h11.5M8.5 12h11.5M8.5 17.5h11.5M4.25 6.5h.010M4.25 12h.010M4.25 17.5h.010" />,
  grid: <>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </>,
};

export const ICON_NAMES = Object.keys(PATHS);

export function Icon({ name, size = 18, strokeWidth = 1.75, flip = false, style, title }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      data-flip={flip ? "" : undefined}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}
