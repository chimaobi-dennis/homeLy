import type { SVGProps } from "react";

/** Line icons (feather-style, stroke = currentColor). Kept inline so the pages ship no icon font. */
const base: SVGProps<SVGSVGElement> = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      {PATHS[name]}
    </svg>
  );
}

export type IconName =
  | "home"
  | "list"
  | "key"
  | "inspect"
  | "fees"
  | "repairs"
  | "chevron-left"
  | "chevron-right"
  | "chevrons-right"
  | "camera"
  | "maximize"
  | "bed"
  | "bath"
  | "ruler"
  | "user"
  | "menu"
  | "grid-2"
  | "grid-3"
  | "list-view"
  | "arrow-right"
  | "map-pin"
  | "phone"
  | "mail"
  | "close"
  | "share"
  | "print"
  | "check"
  | "calendar"
  | "sofa"
  | "heart"
  | "compare"
  | "trash";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="m11.5 11.5 9-9M17 6l2.5 2.5M14.5 8.5 17 11" />
    </>
  ),
  inspect: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
      <path d="M8.5 11.2 10.3 13l3.4-3.6" />
    </>
  ),
  fees: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  repairs: (
    <>
      <path d="M14.5 5.5a4 4 0 0 0-5.3 5.3L4 16l-1 3 1 1 3-1 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.2-.6-.6-2.2z" />
    </>
  ),
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "chevrons-right": <path d="m6 6 6 6-6 6M13 6l6 6-6 6" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  maximize: <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />,
  bed: (
    <>
      <path d="M3 18v-7h18v7M3 11V6h8v5" />
      <path d="M11 11V8.5h7.5A2.5 2.5 0 0 1 21 11" />
      <path d="M3 15h18" />
    </>
  ),
  bath: (
    <>
      <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M6 12V6a2 2 0 0 1 4 0" />
      <path d="M8 20l-1 1M16 20l1 1" />
    </>
  ),
  ruler: (
    <>
      <path d="m3 16 13-13 5 5L8 21z" />
      <path d="m7 12 2 2M10 9l2 2M13 6l2 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  "grid-2": (
    <>
      <rect x="4" y="5" width="6.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="6.5" height="14" rx="1" />
    </>
  ),
  "grid-3": (
    <>
      <rect x="3" y="5" width="5" height="14" rx="1" />
      <rect x="9.5" y="5" width="5" height="14" rx="1" />
      <rect x="16" y="5" width="5" height="14" rx="1" />
    </>
  ),
  "list-view": <path d="M4 7h16M4 12h16M4 17h16" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "map-pin": (
    <>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  share: (
    <>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4M12 2v13" />
    </>
  ),
  print: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M3 12h18v5H3zM5 17v2M19 17v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  compare: (
    <>
      <path d="M16 3h5v5M21 3l-7 7M3 21l7-7M8 21H3v-5" />
      <path d="M3 3l7 7M14 14l7 7" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
};
