// Flat SVG icon set — self-contained, currentColor-driven.
// Racing speed stripes — blue / yellow / red, trailing to the left for motion.
export const Logo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="טורבו">
    <path d="M13 4.5H28.5L24 10.5H8.5Z" fill="#2563eb" />
    <path d="M8 13H28.5L24 19H3.5Z" fill="#f5b700" />
    <path d="M13 21.5H28.5L24 27.5H8.5Z" fill="#ef4444" />
  </svg>
);

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconSun = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.2" {...S} />
    <path {...S} d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
  </svg>
);

export const IconTarget = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.2" {...S} />
    <circle cx="12" cy="12" r="4" {...S} />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

// Aspect icons for the project dashboard (לו״ז / תכולה / משאבים)
export const IconSchedule = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...S} />
    <path {...S} d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
);
export const IconScope = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
    <path {...S} d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </svg>
);
export const IconResources = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <circle cx="9" cy="8" r="3.2" {...S} />
    <path {...S} d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path {...S} d="M16 5.4a3.2 3.2 0 010 5.2M17.5 14.6c2.1.7 3.5 2.5 3.5 4.9" />
  </svg>
);

export const IconProject = () => (
  <svg className="cicon" viewBox="0 0 24 24">
    <path {...S} d="M4 6.5h5.5v11H4zM14.5 6.5H20v6.5h-5.5z" />
    <path {...S} d="M9.5 10h5M9.5 14h5" />
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
