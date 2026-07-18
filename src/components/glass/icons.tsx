import React from "react";

/**
 * DiaPalace Liquid Glass Icon Library
 * -----------------------------------
 * A bespoke macOS-Tahoe-inspired icon system. Two layers:
 *
 *  <Icon />      — crisp SF-Symbols-style glyphs (24x24, rounded strokes)
 *  <GlassTile /> — macOS "liquid glass" squircle app-icon tiles that wrap
 *                  a glyph (or custom content) in layered glass: gradient
 *                  body, specular top-light, rim light and a colored aura.
 */

export type IconName =
  | "gem"
  | "pos"
  | "box"
  | "users"
  | "chart"
  | "logout"
  | "lock"
  | "eye"
  | "eyeOff"
  | "shield"
  | "arrowRight"
  | "search"
  | "cart"
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "trash"
  | "card"
  | "edit"
  | "save"
  | "layers"
  | "file"
  | "phone"
  | "download"
  | "ban"
  | "trending"
  | "wallet"
  | "undo"
  | "banknote"
  | "smartphone"
  | "checkCircle"
  | "printer"
  | "message"
  | "mail"
  | "copy"
  | "alertTriangle"
  | "alertCircle"
  | "info"
  | "sparkles"
  | "chevronLeft"
  | "chevronRight";

const PATHS: Record<IconName, React.ReactNode> = {
  gem: (
    <>
      <path d="M7 3.5h10l4 5.5-9 11.5L3 9l4-5.5Z" />
      <path d="M3 9h18" />
      <path d="M8.5 9 12 20.5M15.5 9 12 20.5M8.5 9 12 3.5M15.5 9 12 3.5" />
    </>
  ),
  pos: (
    <>
      <path d="M5.5 8h13l-1.05 11.3a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7L5.5 8Z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  box: (
    <>
      <path d="M12 3.5 4 7.2v9.6l8 3.7 8-3.7V7.2l-8-3.7Z" />
      <path d="M4 7.2l8 3.7 8-3.7" />
      <path d="M12 10.9v9.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.1" />
      <path d="M3.5 19.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M15.4 5.2a3.1 3.1 0 0 1 0 5.7" />
      <path d="M17.4 15.1c2 .7 3.4 2.1 4 4.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.5h16" />
      <path d="M7 17v-4.5" />
      <path d="M12 17V6.5" />
      <path d="M17 17v-7" />
    </>
  ),
  logout: (
    <>
      <path d="M13.5 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6.5" />
      <path d="M10.5 12H21" />
      <path d="M17.5 8.5 21 12l-3.5 3.5" />
    </>
  ),
  lock: (
    <>
      <path d="M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <path d="M12 14.5v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4.5 20 19.5" />
      <path d="M9.9 6.1A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.7 3.6" />
      <path d="M6 8.2A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5c1.1 0 2.2-.2 3.1-.6" />
      <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 5.5v6c0 4.6 3 7.8 7 9.5 4-1.7 7-4.9 7-9.5v-6L12 3Z" />
      <path d="M12 8.5V13" />
      <path d="M12 16.2h.01" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h15.5" />
      <path d="M13.5 6.5 19.5 12l-6 5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20.5 20.5 16 16" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4.5h2.4l2.2 10.9a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 2-1.5L20.5 8H6.1" />
      <circle cx="10" cy="20.6" r="0.9" />
      <circle cx="17" cy="20.6" r="0.9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M6.5 6.5l1 12.9a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12.9" />
      <path d="M10 10.5v6.5M14 10.5v6.5" />
    </>
  ),
  card: (
    <>
      <path d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z" />
      <path d="M2.5 10h19" />
      <path d="M6 14h4" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20l1-4.4L15.5 5a1.9 1.9 0 0 1 2.7 0l.8.8a1.9 1.9 0 0 1 0 2.7L8.4 19 4 20Z" />
      <path d="M14 6.5 17.5 10" />
    </>
  ),
  save: (
    <>
      <path d="M12 3.5V13" />
      <path d="M8.3 9.4 12 13l3.7-3.6" />
      <path d="M5 15.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
      <path d="M4 12.3 12 16.3l8-4" />
      <path d="M4 16.3 12 20.3l8-4" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5H14L19 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M13.8 3.8V8.7H18.8" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </>
  ),
  phone: (
    <path d="M7.6 3.5h2l1.5 4-2.1 1.6a11.6 11.6 0 0 0 5.4 5.4l1.6-2.1 4 1.5v2a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 5.5 5.7a2 2 0 0 1 2.1-2.2Z" />
  ),
  download: (
    <>
      <path d="M12 4v10" />
      <path d="M8.3 10.4 12 14l3.7-3.6" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  trending: (
    <>
      <path d="M3.5 17.5 9.5 11.5l3.5 3.5 7-7" />
      <path d="M14.8 8h5.2v5.2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a2 2 0 0 1 2 2v1" />
      <path d="M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5h12A1.5 1.5 0 0 0 20 18v-7a1.5 1.5 0 0 0-1.5-1.5H4" />
      <path d="M15.5 13.8h.01" />
    </>
  ),
  undo: (
    <>
      <path d="M8.5 7.5 5 11l3.5 3.5" />
      <path d="M5 11h9a5 5 0 0 1 0 10h-3.5" />
    </>
  ),
  banknote: (
    <>
      <path d="M3.5 7h17v10h-17V7Z" />
      <circle cx="12" cy="12" r="2.3" />
      <path d="M6.4 9.8h.01M17.6 14.2h.01" />
    </>
  ),
  smartphone: (
    <>
      <path d="M9.5 3h5A2 2 0 0 1 16.5 5v14a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M11 17.6h2" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.3 11 14.9l4.6-5.2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V5A1.5 1.5 0 0 1 8.5 3.5h7A1.5 1.5 0 0 1 17 5v3.5" />
      <path d="M4.5 8.5h15A2 2 0 0 1 21.5 10.5v5H17V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19v-3.5H2.5v-5a2 2 0 0 1 2-2Z" />
      <path d="M7 15.5h10" />
      <path d="M16.8 11.3h.01" />
    </>
  ),
  message: (
    <path d="M12 4c-5 0-9 3-9 7 0 2.2 1.2 4.1 3 5.4L5 20l3.7-1.7c1 .4 2.1.7 3.3.7 5 0 9-3 9-7s-4-8-9-8Z" />
  ),
  mail: (
    <>
      <path d="M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
      <path d="M3.2 7.2 12 13l8.8-5.8" />
    </>
  ),
  copy: (
    <>
      <path d="M9.5 9.5H18A1.5 1.5 0 0 1 19.5 11v8a1.5 1.5 0 0 1-1.5 1.5H9.5A1.5 1.5 0 0 1 8 19v-8a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M5.5 14.5V5A1.5 1.5 0 0 1 7 3.5h8" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 4 3 19.5h18L12 4Z" />
      <path d="M12 9.8v4.4" />
      <path d="M12 17h.01" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8V13" />
      <path d="M12 16.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 4.5l1.7 4.3 4.3 1.7-4.3 1.7L11 16.5l-1.7-4.3L5 10.5l4.3-1.7L11 4.5Z" />
      <path d="M18 14.8l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </>
  ),
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, className, strokeWidth = 1.8, style }: IconProps) {
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
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export type TileTone =
  | "brand"
  | "cyan"
  | "violet"
  | "rose"
  | "emerald"
  | "amber"
  | "blue"
  | "indigo"
  | "slate";

export const TILE_TONES: Record<TileTone, [string, string]> = {
  brand: ["#fcd34d", "#fb7185"],
  cyan: ["#67e8f9", "#0ea5e9"],
  violet: ["#c4b5fd", "#8b5cf6"],
  rose: ["#fda4af", "#f43f5e"],
  emerald: ["#6ee7b7", "#10b981"],
  amber: ["#fde68a", "#f59e0b"],
  blue: ["#93c5fd", "#3b82f6"],
  indigo: ["#a5b4fc", "#6366f1"],
  slate: ["#cbd5e1", "#64748b"],
};

export interface GlassTileProps {
  name?: IconName;
  children?: React.ReactNode;
  tone?: TileTone;
  size?: number;
  glyphSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * macOS-style liquid glass squircle tile. Renders either a glyph by name
 * or arbitrary children (e.g. initials) centered in the glass.
 */
export function GlassTile({
  name,
  children,
  tone = "brand",
  size = 44,
  glyphSize,
  className = "",
  style,
}: GlassTileProps) {
  const [c1, c2] = TILE_TONES[tone];
  const tileStyle = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.34),
    "--t1": c1,
    "--t2": c2,
    ...style,
  } as React.CSSProperties;

  return (
    <span className={`glass-tile ${className}`} style={tileStyle}>
      {name ? (
        <Icon name={name} size={glyphSize ?? Math.round(size * 0.52)} strokeWidth={1.9} />
      ) : (
        children
      )}
    </span>
  );
}

const FALLBACK_TONES: TileTone[] = ["cyan", "violet", "rose", "emerald", "amber", "blue", "indigo"];

const CATEGORY_TONES: Record<string, TileTone> = {
  Pomades: "amber",
  Skincare: "emerald",
  Clothing: "violet",
};

/** Deterministic tile tone for a product category. */
export function toneForCategory(category: string): TileTone {
  if (CATEGORY_TONES[category]) return CATEGORY_TONES[category];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}
