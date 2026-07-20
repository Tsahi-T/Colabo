// Print a screen's actual visual, fit to one page. Instead of rebuilding a flat HTML copy
// (which looked nothing like the screen), this prints the real rendered DOM: a print-only
// stylesheet hides the app chrome and everything except the target element, which is scaled
// to fit a single page. Perfect fidelity (real CSS/SVG/colors), no library, no network.

// Approx printable area at 96dpi with ~10mm margins (A4).
const PAGE = {
  portrait: { w: 720, h: 1040 },
  landscape: { w: 1040, h: 720 },
};

export function printElementImage(selector, { title = 'COLABO', landscape = false } = {}) {
  const el = document.querySelector(selector);
  if (!el) return alert('לא נמצא תוכן לייצוא');

  const page = landscape ? PAGE.landscape : PAGE.portrait;
  const ew = el.scrollWidth || el.offsetWidth;
  const eh = el.scrollHeight || el.offsetHeight;
  const scale = Math.min(page.w / ew, page.h / eh, 1.6); // fill the page; cap so it never overflows

  const pageStyle = document.createElement('style');
  pageStyle.textContent = `@page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;
  document.head.appendChild(pageStyle);

  const prevDocTitle = document.title;
  document.title = title; // browsers use the tab title as the PDF file name
  el.style.setProperty('--print-scale', String(scale));
  el.classList.add('print-target');
  document.body.classList.add('printing');

  const cleanup = () => {
    document.body.classList.remove('printing');
    el.classList.remove('print-target');
    el.style.removeProperty('--print-scale');
    pageStyle.remove();
    document.title = prevDocTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // fallback cleanup in case afterprint doesn't fire
  setTimeout(cleanup, 60000);
  window.print();
}
