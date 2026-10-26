// Follow-along reading for the TXT renderer: which paragraph to highlight, how
// many paragraphs fit on a page, and where the reading pane should scroll.
//
// Listening in the sofa is a *reading-along* experience: the voice must stay in
// sync with a visible page, including while the pane is scrolled manually. This
// module keeps that mapping in one testable place instead of scattering
// arithmetic through the DOM code.

export const PAGE_SIZE = 14;
// Bring the active paragraph to the middle when it leaves the comfortable band.
export const SCROLL_BAND = { top: 0.25, bottom: 0.75 };

export function pageStart(paragraph, pageSize = PAGE_SIZE) {
  const size = Math.max(1, pageSize | 0);
  return Math.floor(Math.max(0, paragraph | 0) / size) * size;
}

export function pageWindow(paragraph, total, pageSize = PAGE_SIZE) {
  const start = pageStart(paragraph, pageSize);
  const end = Math.min(Math.max(0, total | 0), start + pageSize);
  return { start, end, page: Math.floor(start / Math.max(1, pageSize)) + 1, pages: Math.max(1, Math.ceil(total / Math.max(1, pageSize))) };
}

export const sameWindow = (a, b) => Boolean(a && b) && a.start === b.start && a.end === b.end;

// Should the pane scroll to keep `paragraph` visible, given the pane's current
// scroll offset? Pure arithmetic so it can be unit-tested without a DOM.
export function needsScroll({ index, top, height, scrollTop, viewportHeight }) {
  if (!Number.isFinite(top) || viewportHeight <= 0) return true;
  const visibleTop = top - scrollTop;
  const bandTop = viewportHeight * SCROLL_BAND.top;
  const bandBottom = viewportHeight * SCROLL_BAND.bottom;
  if (visibleTop < bandTop) return true;
  if (visibleTop + Math.max(0, height) > bandBottom) return true;
  return false;
}

// Scroll target that centres the paragraph, clamped to the scrollable range.
export function scrollTarget({ top, height, viewportHeight, scrollHeight }) {
  const centered = top - (viewportHeight - Math.max(0, height || 0)) / 2;
  const max = Math.max(0, (scrollHeight || 0) - viewportHeight);
  return Math.round(Math.max(0, Math.min(max, centered)));
}

// Highlight markup: the paragraph being spoken is emphasised, the rest of the
// page is dimmed slightly so the eye follows the voice.
export const followClasses = active => (active ? 'rw-follow rw-follow-active' : 'rw-follow');

export const followStyle = '.rw-follow{transition:background .25s,opacity .25s}'
  + '.rw-follow:not(.rw-follow-active){opacity:.55}'
  + '.rw-follow-active{background:#f4eeda;box-shadow:0 0 0 .4rem #f4eeda;border-radius:6px;opacity:1}';
