// Print a screen's actual visual, fit to one page. Instead of rebuilding a flat HTML copy
// (which looked nothing like the screen), this prints the real rendered DOM: a print-only
// stylesheet hides the app chrome and everything except the target element, which is scaled
// to fit a single page. Perfect fidelity (real CSS/SVG/colors), no library, no network.

// Approx printable area at 96dpi with ~10mm margins (A4).
const PAGE = {
  portrait: { w: 720, h: 1040 },
  landscape: { w: 1040, h: 720 },
};

// `clip`: measure the element's own visible box (offsetWidth/Height) instead of its
// full scroll extent. Use it for overflow-hidden viewports like the board canvas, whose
// scroll extent spans the whole infinite canvas and would scale the print to nothing.
export function printElementImage(selector, { title = 'טורבו', landscape = false, clip = false } = {}) {
  const el = document.querySelector(selector);
  if (!el) return alert('לא נמצא תוכן לייצוא');

  // Every editable field (module/task names, risk details, gauge titles, ...) is a
  // `<textarea>` that a GrowingField component resizes via JS whenever its value changes —
  // there's no pure-CSS way to size a textarea to its content. That inline height can go
  // stale (it only re-measures on value change, so a field can end up too short right after
  // mount) or get capped by a deliberate max-height (the gauge title). Either way the on-screen
  // symptom is invisible text a user would have to click in and scroll to see — which print
  // must not silently reproduce. Force every textarea in the target to its true content
  // height, with any max-height cap lifted via inline style so it isn't print-media-gated —
  // and do this BEFORE measuring below, since a still-capped field understates the content's
  // real size and would throw off the fit-to-page scale by exactly the amount it un-clips by.
  const savedStyles = new Map();
  el.querySelectorAll('textarea').forEach((ta) => {
    savedStyles.set(ta, { height: ta.style.height, maxHeight: ta.style.maxHeight });
    ta.style.maxHeight = 'none';
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });

  const page = landscape ? PAGE.landscape : PAGE.portrait;
  const ew = clip ? el.offsetWidth : (el.scrollWidth || el.offsetWidth);
  const eh = clip ? el.offsetHeight : (el.scrollHeight || el.offsetHeight);
  const scale = Math.min(page.w / ew, page.h / eh, 1.6); // fill the page; cap so it never overflows

  const pageStyle = document.createElement('style');
  pageStyle.textContent = `@page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;
  document.head.appendChild(pageStyle);

  const prevDocTitle = document.title;
  document.title = title; // browsers use the tab title as the PDF file name
  el.style.setProperty('--print-scale', String(scale));
  // Pin the target to its exact on-screen size during print. Without this, a target
  // that was sized by `inset:0` (e.g. the sun stage) keeps its leftover right/bottom
  // when the print rule flips it to position:fixed + left/top:50%, producing a broken
  // box that misaligns the SVG coordinate space from the absolutely-positioned nodes.
  el.style.setProperty('--print-w', ew + 'px');
  el.style.setProperty('--print-h', eh + 'px');
  el.classList.add('print-target');
  document.body.classList.add('printing');

  const cleanup = () => {
    document.body.classList.remove('printing');
    el.classList.remove('print-target');
    el.style.removeProperty('--print-scale');
    el.style.removeProperty('--print-w');
    el.style.removeProperty('--print-h');
    savedStyles.forEach((s, ta) => { ta.style.height = s.height; ta.style.maxHeight = s.maxHeight; });
    pageStyle.remove();
    document.title = prevDocTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // fallback cleanup in case afterprint doesn't fire
  setTimeout(cleanup, 60000);
  window.print();
}
