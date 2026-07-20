// Flat SVG icon set — self-contained, currentColor-driven.
export const Logo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="COLABO">
    <rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="var(--accent)" />
    <rect x="9.5" y="9.5" width="21" height="21" rx="7" fill="#18b26b" fillOpacity=".92" />
    <path d="M15 21.5h10M15 25.5h6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
  </svg>
);

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconSun = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.2" {...S} />
    <path {...S} d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
  </svg>
);

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

export const IconChat = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M4 5h16v11H9l-5 4V5z" />
    <path {...S} d="M8 9.5h8M8 12.5h5" />
  </svg>
);

export const IconRisk = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M4 4h7v7H4zM13 13h7v7h-7zM4 13h7v7H4z" />
    <rect x="13" y="4" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSwot = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <rect x="3" y="3" width="8" height="8" rx="1.5" {...S} />
    <rect x="13" y="3" width="8" height="8" rx="1.5" {...S} />
    <rect x="3" y="13" width="8" height="8" rx="1.5" {...S} />
    <rect x="13" y="13" width="8" height="8" rx="1.5" {...S} />
  </svg>
);

export const IconTasks = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M4 5.5l1.5 1.5L8.5 4M4 12l1.5 1.5L8.5 10M4 18.5l1.5 1.5L8.5 16.5" />
    <path {...S} d="M12 6h8M12 12.5h8M12 19h8" />
  </svg>
);

export const IconTimeline = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M21 12H4.5M4.5 12l3.2-3.2M4.5 12l3.2 3.2" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="2.3" fill="currentColor" stroke="none" />
  </svg>
);
