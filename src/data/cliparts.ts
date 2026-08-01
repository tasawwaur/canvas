export const CLIPARTS: Record<string, string> = {
  north_arrow: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" stroke="%23f59e0b" stroke-width="2" fill="rgba(15, 23, 42, 0.7)"/>
    <path d="M50 15L65 55L50 48L35 55L50 15Z" fill="%23ef4444" stroke="%23ef4444" stroke-width="2"/>
    <path d="M50 85L65 55L50 62L35 55L50 85Z" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="2"/>
    <text x="50" y="39" fill="%23ffffff" font-family="Inter, Arial" font-size="12" font-weight="bold" text-anchor="middle">N</text>
  </svg>`.replace(/\s+/g, ' '),

  tree: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="42" fill="rgba(16, 185, 129, 0.2)" stroke="%2310b981" stroke-width="2"/>
    <circle cx="50" cy="50" r="32" fill="rgba(16, 185, 129, 0.35)" stroke="%23059669" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle cx="50" cy="50" r="10" fill="%23047857"/>
    <line x1="50" y1="8" x2="50" y2="92" stroke="%23047857" stroke-width="1.5"/>
    <line x1="8" y1="50" x2="92" y2="50" stroke="%23047857" stroke-width="1.5"/>
  </svg>`.replace(/\s+/g, ' '),

  car: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="32" y="15" width="36" height="70" rx="8" fill="rgba(14, 165, 233, 0.25)" stroke="%230ea5e9" stroke-width="2.5"/>
    <rect x="36" y="32" width="28" height="20" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="%2338bdf8" stroke-width="1.5"/>
    <rect x="38" y="60" width="24" height="15" fill="rgba(15, 23, 42, 0.85)" stroke="%2338bdf8" stroke-width="1.5"/>
    <rect x="27" y="24" width="5" height="12" rx="2" fill="%23475569"/>
    <rect x="68" y="24" width="5" height="12" rx="2" fill="%23475569"/>
    <rect x="27" y="64" width="5" height="12" rx="2" fill="%23475569"/>
    <rect x="68" y="64" width="5" height="12" rx="2" fill="%23475569"/>
  </svg>`.replace(/\s+/g, ' '),

  scale: `data:image/svg+xml;utf8,<svg viewBox="0 0 150 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="20" width="130" height="12" fill="rgba(15, 23, 42, 0.8)" stroke="%23ffffff" stroke-width="1.5" rx="2"/>
    <rect x="10" y="20" width="32.5" height="12" fill="%23f59e0b"/>
    <rect x="75" y="20" width="32.5" height="12" fill="%23f59e0b"/>
    <text x="10" y="13" fill="%23ffffff" font-family="Inter, Arial" font-size="8" font-weight="bold" text-anchor="middle">0</text>
    <text x="75" y="13" fill="%23ffffff" font-family="Inter, Arial" font-size="8" font-weight="bold" text-anchor="middle">50m</text>
    <text x="140" y="13" fill="%23ffffff" font-family="Inter, Arial" font-size="8" font-weight="bold" text-anchor="middle">100m</text>
  </svg>`.replace(/\s+/g, ' ')
};
