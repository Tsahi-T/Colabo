// Flat SVG icon set — self-contained, currentColor-driven.
export const Logo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="COLABO">
    <rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="var(--accent)" />
    <rect x="9.5" y="9.5" width="21" height="21" rx="7" fill="#18b26b" fillOpacity=".92" />
    <path d="M15 21.5h10M15 25.5h6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
  </svg>
);

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconDoc = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M6 3h8l5 5v13H6z" />
    <path {...S} d="M14 3v5h5M9.5 12.5h7M9.5 16h7" />
  </svg>
);

export const IconBoard = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M4 4h16v10l-6 6H4z" />
    <path {...S} d="M14 20v-6h6M8 9h8M8 13h4" />
  </svg>
);

export const IconTimeline = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M21 12H4.5M4.5 12l3.2-3.2M4.5 12l3.2 3.2" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="2.3" fill="currentColor" stroke="none" />
  </svg>
);
